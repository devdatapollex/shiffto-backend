import httpStatus from "http-status";
import prisma from "../../lib/prisma";
import ApiError from "../../errors/ApiError";
import { auth } from "../../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ProfileValidation } from "./profile.validation";

const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      kyc: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

const updateProfile = async (
  userId: string,
  payload: z.infer<typeof ProfileValidation.updateProfileSchema>,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      name: payload.name,
      phone: payload.phone,
      image: payload.image,
    },
    include: {
      kyc: true,
    },
  });

  return updatedUser;
};

const changePassword = async (
  headers: any,
  payload: z.infer<typeof ProfileValidation.changePasswordSchema>,
) => {
  try {
    await auth.api.changePassword({
      headers: fromNodeHeaders(headers),
      body: {
        currentPassword: payload.currentPassword,
        newPassword: payload.newPassword,
      },
    });
  } catch (error: any) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      error?.message ||
        "Failed to change password. Make sure current password is correct.",
    );
  }
};

const submitKyc = async (
  userId: string,
  payload: z.infer<typeof ProfileValidation.submitKycSchema>,
) => {
  const existingKyc = await prisma.kyc.findUnique({
    where: { userId },
  });

  if (existingKyc && existingKyc.status === "APPROVED") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Your KYC is already approved.");
  }

  const kyc = await prisma.kyc.upsert({
    where: { userId },
    update: {
      documentType: payload.documentType,
      documentNumber: payload.documentNumber,
      nationality: payload.nationality,
      phoneNumber: payload.phoneNumber,
      frontPhotoUrl: payload.frontPhotoUrl,
      frontPhotoKey: payload.frontPhotoKey,
      backPhotoUrl: payload.backPhotoUrl,
      backPhotoKey: payload.backPhotoKey,
      status: "PENDING",
      rejectionReason: null,
    },
    create: {
      userId,
      documentType: payload.documentType,
      documentNumber: payload.documentNumber,
      nationality: payload.nationality,
      phoneNumber: payload.phoneNumber,
      frontPhotoUrl: payload.frontPhotoUrl,
      frontPhotoKey: payload.frontPhotoKey,
      backPhotoUrl: payload.backPhotoUrl,
      backPhotoKey: payload.backPhotoKey,
      status: "PENDING",
    },
  });

  return kyc;
};

const deactivateAccount = async (userId: string) => {
  // Check if active shipments exist (assigned to a trip)
  const activeShipmentsCount = await prisma.shipment.count({
    where: {
      userId,
      tripId: { not: null },
    },
  });

  if (activeShipmentsCount > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot deactivate account because you have active shipments currently matched or in transit.",
    );
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      isDeactivated: true,
    },
  });

  return updatedUser;
};

const deleteAccount = async (
  userId: string,
  payload: z.infer<typeof ProfileValidation.deleteAccountSchema>,
) => {
  // Check active shipments
  const activeShipmentsCount = await prisma.shipment.count({
    where: {
      userId,
      tripId: { not: null },
    },
  });

  if (activeShipmentsCount > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot delete account because you have active shipments currently matched or in transit.",
    );
  }

  // Verify password
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
  });

  if (!account || !account.password) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Account credentials not found. Social login accounts cannot be deleted with a password check.",
    );
  }

  const isPasswordMatch = await bcrypt.compare(
    payload.password,
    account.password,
  );
  if (!isPasswordMatch) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Incorrect password. Please verify and try again.",
    );
  }

  // Delete all user related data in a transaction
  await prisma.$transaction([
    prisma.shipment.deleteMany({ where: { userId } }),
    prisma.trip.deleteMany({ where: { userId } }),
    prisma.kyc.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return { success: true };
};

const getAnalytics = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      trustScore: true,
      commissionRate: true,
      kyc: { select: { status: true } },
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  // 1. Shipment Metrics
  const shipmentsCreated = await prisma.shipment.count({
    where: { userId },
  });

  const activeShipments = await prisma.shipment.count({
    where: { userId, status: "ACTIVE" },
  });

  const deliveredShipments = await prisma.shipment.count({
    where: { userId, status: "DELIVERED" },
  });

  // 2. Trip Metrics
  const tripsAdded = await prisma.trip.count({
    where: { userId },
  });

  const activeTrips = await prisma.trip.count({
    where: { userId, status: "ACTIVE" },
  });

  const completedTrips = await prisma.trip.count({
    where: { userId, status: "COMPLETED" },
  });

  // 3. Payment & Earnings Metrics
  const releasedTxns = await prisma.paymentTransaction.aggregate({
    where: { travellerId: userId, status: "RELEASED" },
    _sum: { grossAmount: true },
  });
  const totalEarnings = releasedTxns._sum?.grossAmount || 0;

  const escrowTxns = await prisma.paymentTransaction.aggregate({
    where: { travellerId: userId, status: "ESCROWED" },
    _sum: { grossAmount: true },
  });
  const pendingEarnings = escrowTxns._sum?.grossAmount || 0;

  const senderTxns = await prisma.paymentTransaction.aggregate({
    where: {
      senderId: userId,
      status: { in: ["ESCROWED", "RELEASED"] },
    },
    _sum: { grossAmount: true },
  });
  const totalSpending = senderTxns._sum?.grossAmount || 0;

  // Completed/Approved withdrawals
  const completedWithdrawals = await prisma.withdrawalRequest.aggregate({
    where: { userId, status: "APPROVED" },
    _sum: { grossAmount: true },
  });
  const totalWithdrawn = completedWithdrawals._sum?.grossAmount || 0;

  const availableBalance = Math.max(0, totalEarnings - totalWithdrawn);

  // 4. Recent Shipments & Trips
  const recentShipments = await prisma.shipment.findMany({
    where: { userId },
    take: 4,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      itemName: true,
      status: true,
      fromCountry: true,
      toCountry: true,
      weight: true,
      pricePerKg: true,
      createdAt: true,
    },
  });

  const recentTrips = await prisma.trip.findMany({
    where: { userId },
    take: 4,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      flightNumber: true,
      status: true,
      fromCountry: true,
      toCountry: true,
      flightDate: true,
      createdAt: true,
    },
  });

  // 5. Open Tickets Count
  const openTicketsCount = await prisma.ticket.count({
    where: {
      OR: [{ userId }, { senderId: userId }, { travelerId: userId }],
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
  });

  // 6. Unread Notifications Count
  const unreadNotificationsCount = await prisma.notification.count({
    where: { userId, read: false },
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      trustScore: user.trustScore,
      kycStatus: user.kyc?.status || "NOT_SUBMITTED",
    },
    stats: {
      shipmentsCreated,
      activeShipments,
      deliveredShipments,
      tripsAdded,
      activeTrips,
      completedTrips,
      totalEarnings,
      pendingEarnings,
      totalSpending,
      availableBalance,
      openTicketsCount,
      unreadNotificationsCount,
    },
    recentShipments: recentShipments.map((s) => ({
      ...s,
      totalCost: s.weight * s.pricePerKg,
    })),
    recentTrips,
  };
};

export const ProfileService = {
  getProfile,
  updateProfile,
  changePassword,
  submitKyc,
  deactivateAccount,
  deleteAccount,
  getAnalytics,
};

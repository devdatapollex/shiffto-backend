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
    _sum: { netAmount: true },
  });
  const totalEarnings = releasedTxns._sum?.netAmount || 0;

  const escrowTxns = await prisma.paymentTransaction.aggregate({
    where: { travellerId: userId, status: "ESCROWED" },
    _sum: { netAmount: true },
  });
  const pendingEarnings = escrowTxns._sum?.netAmount || 0;

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
    _sum: { amount: true },
  });
  const totalWithdrawn = completedWithdrawals._sum?.amount || 0;

  // Pending withdrawals (awaiting payout)
  const pendingWithdrawals = await prisma.withdrawalRequest.aggregate({
    where: { userId, status: "PENDING" },
    _sum: { amount: true },
  });
  const awaitingPayout = pendingWithdrawals._sum?.amount || 0;

  const availableBalance = Math.max(
    0,
    totalEarnings - totalWithdrawn - awaitingPayout,
  );

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
      quantity: true,
      pricePerKg: true,
      itemPhotos: true,
      createdAt: true,
      trip: {
        select: {
          flightDate: true,
          flightTime: true,
          airportArrivalTime: true,
          fromCountry: true,
          toCountry: true,
        },
      },
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
      flightTime: true,
      airportArrivalTime: true,
      cabinBagCapacity: true,
      checkInBagCapacity: true,
      remainingCabinCapacity: true,
      remainingCheckInCapacity: true,
      createdAt: true,
      _count: {
        select: { shipments: true },
      },
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
    recentTrips: recentTrips.map((t) => ({
      id: t.id,
      flightNumber: t.flightNumber,
      status: t.status,
      fromCountry: t.fromCountry,
      toCountry: t.toCountry,
      flightDate: t.flightDate,
      flightTime: t.flightTime,
      airportArrivalTime: t.airportArrivalTime,
      cabinBagCapacity: t.cabinBagCapacity || 0,
      checkInBagCapacity: t.checkInBagCapacity || 0,
      remainingCabinCapacity: t.remainingCabinCapacity || 0,
      remainingCheckInCapacity: t.remainingCheckInCapacity || 0,
      shipmentsCount: t._count?.shipments || 0,
      createdAt: t.createdAt,
    })),
  };
};

const getRevenueChart = async (
  userId: string,
  query?: { range?: string; startDate?: string; endDate?: string },
) => {
  let endDate = new Date();
  let startDate = new Date();
  let daysCount = 7;

  if (query?.startDate && query?.endDate) {
    startDate = new Date(query.startDate);
    endDate = new Date(query.endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    daysCount = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  } else {
    const range = query?.range || "7d";
    if (range === "14d") daysCount = 14;
    else if (range === "30d") daysCount = 30;
    else if (range === "this-month") {
      daysCount = endDate.getDate();
    }
    startDate.setDate(endDate.getDate() - (daysCount - 1));
    startDate.setHours(0, 0, 0, 0);
  }

  const transactions = await prisma.paymentTransaction.findMany({
    where: {
      OR: [{ senderId: userId }, { travellerId: userId }],
      status: { in: ["ESCROWED", "RELEASED"] },
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  const daysMap: Record<
    string,
    { day: string; spent: number; earned: number }
  > = {};

  for (let i = 0; i < daysCount; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dayNum = d.getDate().toString();
    const dateKey = d.toISOString().split("T")[0] || "";
    if (dateKey) {
      daysMap[dateKey] = {
        day: dayNum,
        spent: 0,
        earned: 0,
      };
    }
  }

  let totalSpent = 0;
  let totalEarned = 0;

  for (const txn of transactions) {
    const dateKey = txn.createdAt.toISOString().split("T")[0] || "";
    const dayEntry = daysMap[dateKey];
    if (dayEntry) {
      if (txn.senderId === userId) {
        dayEntry.spent += txn.grossAmount;
        totalSpent += txn.grossAmount;
      }
      if (txn.travellerId === userId) {
        dayEntry.earned += txn.grossAmount;
        totalEarned += txn.grossAmount;
      }
    }
  }

  const chartData = Object.values(daysMap);
  const totalVolume = totalEarned + totalSpent;
  const hasTxns = transactions.length > 0;

  const startMonthStr = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endMonthStr = endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const dateRangeText = `${startMonthStr} - ${endMonthStr}`;

  return {
    totalAmount: `$${totalVolume.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    percentageChange: hasTxns ? "+29.3%" : "0%",
    dateRangeText,
    chartData,
  };
};

const getShipmentChart = async (userId: string, yearStr?: string) => {
  const currentYear = new Date().getFullYear();
  const targetYear = yearStr ? parseInt(yearStr, 10) : currentYear;

  const earliestShipment = await prisma.shipment.findFirst({
    where: { OR: [{ userId }, { trip: { userId } }] },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const startYr = earliestShipment
    ? earliestShipment.createdAt.getFullYear()
    : currentYear;
  const availableYears: string[] = [];

  for (let y = currentYear; y >= Math.min(startYr, currentYear - 3); y--) {
    availableYears.push(y.toString());
  }

  const startOfYear = new Date(targetYear, 0, 1);
  const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);

  const shipments = await prisma.shipment.findMany({
    where: {
      OR: [{ userId }, { trip: { userId } }],
      status: { in: ["DELIVERED", "CANCELED"] },
      createdAt: { gte: startOfYear, lte: endOfYear },
    },
    select: {
      status: true,
      createdAt: true,
    },
  });

  const monthsLabels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthlyData = monthsLabels.map((m) => ({
    month: m,
    canceled: 0,
    completed: 0,
  }));

  let totalCompleted = 0;
  let totalCanceled = 0;

  for (const s of shipments) {
    const monthIdx = s.createdAt.getMonth();
    const entry = monthlyData[monthIdx];
    if (entry) {
      if (s.status === "DELIVERED") {
        entry.completed += 1;
        totalCompleted += 1;
      } else if (s.status === "CANCELED") {
        entry.canceled += 1;
        totalCanceled += 1;
      }
    }
  }

  const totalDeliveries = totalCompleted + totalCanceled;

  return {
    totalDeliveries: `${totalDeliveries.toLocaleString()} deliveries`,
    percentageChange: shipments.length > 0 ? "29,3%" : "0%",
    selectedYear: targetYear.toString(),
    availableYears,
    data: monthlyData,
  };
};

const abortSignup = async (email: string) => {
  if (!email) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Email is required to abort registration",
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: email.trim().toLowerCase(), mode: "insensitive" },
    },
    select: { id: true, emailVerified: true },
  });

  if (!user) {
    return { success: true, message: "User not found or already deleted" };
  }

  if (user.emailVerified) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot abort registration for a verified account",
    );
  }

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.account.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  return {
    success: true,
    message: "Signup aborted and account deleted successfully",
  };
};

export const ProfileService = {
  getProfile,
  updateProfile,
  changePassword,
  submitKyc,
  deactivateAccount,
  deleteAccount,
  abortSignup,
  getAnalytics,
  getRevenueChart,
  getShipmentChart,
};

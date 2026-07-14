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
  payload: z.infer<typeof ProfileValidation.updateProfileSchema>["body"],
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
  payload: z.infer<typeof ProfileValidation.changePasswordSchema>["body"],
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
  payload: z.infer<typeof ProfileValidation.submitKycSchema>["body"],
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
  payload: z.infer<typeof ProfileValidation.deleteAccountSchema>["body"],
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

export const ProfileService = {
  getProfile,
  updateProfile,
  changePassword,
  submitKyc,
  deactivateAccount,
  deleteAccount,
};

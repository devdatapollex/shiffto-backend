import httpStatus from "http-status";
import prisma from "../../lib/prisma";
import ApiError from "../../errors/ApiError";
import { paginationHelpers } from "../../helper/paginationHelpers";

const getKycSubmissions = async (query: Record<string, unknown>) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(query);

  const where: any = {};
  if (query.status) {
    where.status = query.status as string;
  }

  const data = await prisma.kyc.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          phone: true,
        },
      },
    },
  });

  const total = await prisma.kyc.count({ where });

  return {
    data,
    meta: { page, limit, total },
  };
};

const reviewKyc = async (
  kycId: string,
  status: "APPROVED" | "REJECTED",
  rejectionReason?: string | null,
) => {
  const kyc = await prisma.kyc.findUnique({
    where: { id: kycId },
  });

  if (!kyc) {
    throw new ApiError(httpStatus.NOT_FOUND, "KYC submission not found");
  }

  const updatedKyc = await prisma.kyc.update({
    where: { id: kycId },
    data: {
      status,
      rejectionReason: status === "REJECTED" ? rejectionReason : null,
    },
  });

  return updatedKyc;
};

const reactivateUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      isDeactivated: false,
    },
  });

  return updatedUser;
};

export const AdminService = {
  getKycSubmissions,
  reviewKyc,
  reactivateUser,
};

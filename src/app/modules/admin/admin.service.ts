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

const getAdminAnalytics = async () => {
  const [
    totalUsers,
    approvedKycUsers,
    totalShipments,
    activeShipments,
    deliveredShipments,
    totalTrips,
    activeTrips,
    completedTrips,
    pendingKycCount,
    pendingTripsCount,
    openTicketsCount,
    pendingWithdrawalsCount,
    paymentAgg,
    withdrawalAgg,
    recentKyc,
    recentTickets,
    recentPayments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.kyc.count({ where: { status: "APPROVED" } }),
    prisma.shipment.count(),
    prisma.shipment.count({ where: { status: "ACTIVE" } }),
    prisma.shipment.count({ where: { status: "DELIVERED" } }),
    prisma.trip.count(),
    prisma.trip.count({
      where: { status: { in: ["UPCOMING", "PENDING", "APPROVED"] } },
    }),
    prisma.trip.count({ where: { status: "COMPLETED" } }),
    prisma.kyc.count({ where: { status: "PENDING" } }),
    prisma.trip.count({ where: { status: "PENDING" } }),
    prisma.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
    prisma.paymentTransaction.aggregate({
      _sum: { grossAmount: true },
    }),
    prisma.withdrawalRequest.aggregate({
      _sum: { commissionAmount: true },
    }),
    prisma.kyc.findMany({
      where: { status: "PENDING" },
      take: 5,
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
    }),
    prisma.ticket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    }),
    prisma.paymentTransaction.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        traveller: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const totalVolume = paymentAgg._sum.grossAmount || 0;
  const totalCommission = withdrawalAgg._sum.commissionAmount || 0;

  const chartData = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = new Date(
      d.getFullYear(),
      d.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const monthLabel = d.toLocaleString("en-US", { month: "short" });

    const [monthShipments, monthTrips, monthPayments] = await Promise.all([
      prisma.shipment.count({
        where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
      }),
      prisma.trip.count({
        where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
      }),
      prisma.paymentTransaction.aggregate({
        where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { grossAmount: true },
      }),
    ]);

    chartData.push({
      month: monthLabel,
      shipments: monthShipments,
      trips: monthTrips,
      volume: monthPayments._sum.grossAmount || 0,
    });
  }

  return {
    stats: {
      totalUsers,
      approvedKycUsers,
      totalShipments,
      activeShipments,
      deliveredShipments,
      totalTrips,
      activeTrips,
      completedTrips,
      pendingKycCount,
      pendingTripsCount,
      openTicketsCount,
      pendingWithdrawalsCount,
      totalVolume,
      totalCommission,
    },
    chartData,
    recentKyc,
    recentTickets,
    recentPayments,
  };
};

export const AdminService = {
  getKycSubmissions,
  reviewKyc,
  reactivateUser,
  getAdminAnalytics,
};

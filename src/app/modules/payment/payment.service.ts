import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { User } from "../../lib/auth";
import { Prisma } from "../../../generated/prisma/client";
import {
  PaymentStatus,
  OfferStatus,
  WithdrawalStatus,
  ShipmentStatus,
} from "../../../generated/prisma/enums";
import { ShipmentStepService } from "../shipment/shipment-step.service";

const getSenderPaymentsSummary = async (userId: string) => {
  const transactions = await prisma.paymentTransaction.findMany({
    where: { senderId: userId },
    include: {
      shipment: {
        select: {
          id: true,
          itemName: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let totalSpent = 0;
  let pendingAmount = 0;
  let refundedAmount = 0;
  const disputeMoney = 0;

  transactions.forEach((tx) => {
    if (tx.status === PaymentStatus.RELEASED) {
      totalSpent += tx.grossAmount;
    } else if (
      tx.status === PaymentStatus.ESCROWED ||
      tx.status === PaymentStatus.PENDING_RELEASE
    ) {
      pendingAmount += tx.grossAmount;
    } else if (tx.status === PaymentStatus.REFUNDED) {
      refundedAmount += tx.grossAmount;
    }
  });

  return {
    stats: {
      totalSpent,
      pendingAmount,
      refundedAmount,
      disputeMoney,
    },
    transactions,
  };
};

const getTravelerEarningsSummary = async (userId: string) => {
  // Fetch all payment transactions earned by traveler
  const transactions = await prisma.paymentTransaction.findMany({
    where: { travellerId: userId },
    include: {
      shipment: {
        select: {
          id: true,
          itemName: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate net earnings
  let totalEarnings = 0;
  let escrowedEarnings = 0;
  let pendingReleaseEarnings = 0;

  transactions.forEach((tx) => {
    if (tx.status === PaymentStatus.RELEASED) {
      totalEarnings += tx.netAmount;
    } else if (tx.status === PaymentStatus.ESCROWED) {
      escrowedEarnings += tx.netAmount;
    } else if (tx.status === PaymentStatus.PENDING_RELEASE) {
      pendingReleaseEarnings += tx.netAmount;
    }
  });

  // Fetch withdrawal requests by traveler
  const withdrawalRequests = await prisma.withdrawalRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  let awaitingPayout = 0;
  let totalWithdrawn = 0;

  withdrawalRequests.forEach((req) => {
    if (req.status === WithdrawalStatus.PENDING) {
      awaitingPayout += req.amount;
      totalWithdrawn += req.amount;
    } else if (req.status === WithdrawalStatus.APPROVED) {
      totalWithdrawn += req.amount;
    }
  });

  const availableForWithdrawal = Math.max(0, totalEarnings - totalWithdrawn);

  return {
    stats: {
      totalEarnings,
      escrowedEarnings,
      pendingReleaseEarnings,
      awaitingPayout,
      disputeAmount: 0,
      availableForWithdrawal,
      totalWithdrawn,
    },
    earningsHistory: transactions,
    withdrawalHistory: withdrawalRequests,
  };
};

const handlePaymentSuccess = async (
  transactionId: string,
  gatewayTxnId?: string,
) => {
  return prisma.$transaction(async (tx) => {
    const paymentTx = await tx.paymentTransaction.findUnique({
      where: { transactionId },
      include: {
        offer: true,
        shipment: true,
        sender: true,
      },
    });

    if (!paymentTx) {
      throw new ApiError(httpStatus.NOT_FOUND, "Payment transaction not found");
    }

    if (paymentTx.status === PaymentStatus.ESCROWED) {
      return paymentTx; // Idempotent check
    }

    // 1. Update PaymentTransaction to ESCROWED
    const updatedPaymentTx = await tx.paymentTransaction.update({
      where: { id: paymentTx.id },
      data: {
        status: PaymentStatus.ESCROWED,
        ...(gatewayTxnId && { gatewayTxnId }),
      },
    });

    // 2. Update offer to ACCEPTED
    await tx.offer.update({
      where: { id: paymentTx.offerId },
      data: { status: OfferStatus.ACCEPTED },
    });

    // 3. Reject all other pending offers for this shipment
    await tx.offer.updateMany({
      where: {
        shipmentId: paymentTx.shipmentId,
        id: { not: paymentTx.offerId },
        status: { in: [OfferStatus.PENDING, OfferStatus.PAYMENT_PENDING] },
      },
      data: { status: OfferStatus.REJECTED },
    });

    // 4. Link shipment to trip, bagType, pricePerKg
    await tx.shipment.update({
      where: { id: paymentTx.shipmentId },
      data: {
        tripId: paymentTx.offer.tripId,
        bagType: paymentTx.offer.bagType,
        pricePerKg: paymentTx.offer.offeredPrice,
      },
    });

    // 5. Advance PAYMENT_CONFIRMED step to ACTIVE shipment
    await ShipmentStepService.confirmPayment(
      paymentTx.shipmentId,
      paymentTx.sender as User,
      tx,
    );

    // 6. Notify traveler & sender
    await tx.notification.create({
      data: {
        userId: paymentTx.travellerId,
        title: "Payment Received in Escrow",
        message: `Payment of $${paymentTx.grossAmount} for shipment "${paymentTx.shipment.itemName}" is held in escrow. You may now pick up the item.`,
      },
    });

    return updatedPaymentTx;
  });
};

const handlePaymentFailureOrExpiration = async (transactionId: string) => {
  return prisma.$transaction(async (tx) => {
    const paymentTx = await tx.paymentTransaction.findUnique({
      where: { transactionId },
      include: {
        offer: {
          include: {
            shipment: true,
            trip: true,
          },
        },
      },
    });

    if (!paymentTx) return null;

    if (paymentTx.status === PaymentStatus.PENDING_PAYMENT) {
      await tx.paymentTransaction.update({
        where: { id: paymentTx.id },
        data: { status: PaymentStatus.FAILED },
      });

      if (
        paymentTx.offer &&
        paymentTx.offer.status === OfferStatus.PAYMENT_PENDING
      ) {
        // Restore trip capacity
        const offer = paymentTx.offer;
        const weight = offer.shipment.weight;
        if (offer.bagType === "cabin") {
          await tx.trip.update({
            where: { id: offer.tripId },
            data: { remainingCabinCapacity: { increment: weight } },
          });
        } else {
          await tx.trip.update({
            where: { id: offer.tripId },
            data: { remainingCheckInCapacity: { increment: weight } },
          });
        }

        await tx.offer.update({
          where: { id: paymentTx.offerId },
          data: { status: OfferStatus.PAYMENT_CANCELED },
        });
      }
    }
    return paymentTx;
  });
};

const releasePayment = async (transactionId: string, adminUser: User) => {
  if (adminUser.role !== "admin") {
    throw new ApiError(httpStatus.FORBIDDEN, "Only admin can release payment");
  }

  return prisma.$transaction(async (tx) => {
    const paymentTx = await tx.paymentTransaction.findUnique({
      where: { transactionId },
      include: { shipment: true },
    });

    if (!paymentTx) {
      throw new ApiError(httpStatus.NOT_FOUND, "Payment transaction not found");
    }

    if (paymentTx.status === PaymentStatus.RELEASED) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Payment is already released");
    }

    if (
      paymentTx.status !== PaymentStatus.PENDING_RELEASE &&
      paymentTx.status !== PaymentStatus.ESCROWED
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot release payment with status ${paymentTx.status}`,
      );
    }

    const updated = await tx.paymentTransaction.update({
      where: { id: paymentTx.id },
      data: {
        status: PaymentStatus.RELEASED,
        releasedAt: new Date(),
        releasedBy: adminUser.id,
      },
    });

    await tx.notification.create({
      data: {
        userId: paymentTx.travellerId,
        title: "Earnings Released",
        message: `Your earnings of $${paymentTx.grossAmount} for shipment "${paymentTx.shipment.itemName}" have been verified and released!`,
      },
    });

    return updated;
  });
};

interface GetAdminPaymentsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

const getAdminPayments = async (query: GetAdminPaymentsQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const whereConditions: Prisma.PaymentTransactionWhereInput = {};

  if (query.search) {
    const s = query.search.trim();
    whereConditions.OR = [
      { transactionId: { contains: s, mode: "insensitive" } },
      { gatewayTxnId: { contains: s, mode: "insensitive" } },
      { shipment: { itemName: { contains: s, mode: "insensitive" } } },
      { sender: { name: { contains: s, mode: "insensitive" } } },
      { sender: { email: { contains: s, mode: "insensitive" } } },
      { traveller: { name: { contains: s, mode: "insensitive" } } },
      { traveller: { email: { contains: s, mode: "insensitive" } } },
    ];
  }

  if (query.status && query.status !== "ALL") {
    whereConditions.status = query.status.toUpperCase() as PaymentStatus;
  }

  const orderByField = query.sortBy || "createdAt";
  const orderByDir = query.sortOrder || "desc";

  const transactions = await prisma.paymentTransaction.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { [orderByField]: orderByDir },
    include: {
      shipment: {
        select: {
          id: true,
          itemName: true,
          status: true,
          weight: true,
          tripId: true,
        },
      },
      offer: {
        select: {
          id: true,
          tripId: true,
          offeredPrice: true,
          trip: {
            select: {
              id: true,
              fromCountry: true,
              toCountry: true,
            },
          },
        },
      },
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
        },
      },
      traveller: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
        },
      },
    },
  });

  const total = await prisma.paymentTransaction.count({
    where: whereConditions,
  });

  // Compute overall KPI statistics
  const allTxns = await prisma.paymentTransaction.findMany({
    select: {
      grossAmount: true,
      commissionAmount: true,
      netAmount: true,
      commissionRate: true,
      status: true,
    },
  });

  let totalPlatformRevenue = 0;
  let totalGrossVolume = 0;
  let totalEscrowed = 0;
  let totalPendingRelease = 0;
  let totalReleased = 0;
  let totalRefunded = 0;

  allTxns.forEach((tx) => {
    const commission =
      tx.commissionAmount > 0
        ? tx.commissionAmount
        : tx.grossAmount * (tx.commissionRate || 0.3);
    const net = tx.netAmount > 0 ? tx.netAmount : tx.grossAmount - commission;

    if (
      tx.status === PaymentStatus.PENDING_RELEASE ||
      tx.status === PaymentStatus.RELEASED
    ) {
      totalPlatformRevenue += commission;
      totalGrossVolume += tx.grossAmount;
    }

    if (tx.status === PaymentStatus.ESCROWED) {
      totalEscrowed += tx.grossAmount;
    } else if (tx.status === PaymentStatus.PENDING_RELEASE) {
      totalPendingRelease += tx.grossAmount;
    } else if (tx.status === PaymentStatus.RELEASED) {
      totalReleased += net;
    } else if (
      tx.status === PaymentStatus.REFUNDED ||
      tx.status === PaymentStatus.FAILED
    ) {
      totalRefunded += tx.grossAmount;
    }
  });

  const commissionRate = 0.3; // Standard 30% commission

  const data = transactions.map((tx) => {
    const commissionAmount =
      tx.commissionAmount > 0
        ? tx.commissionAmount
        : tx.grossAmount * commissionRate;
    const netAmount =
      tx.netAmount > 0 ? tx.netAmount : tx.grossAmount - commissionAmount;
    return {
      ...tx,
      commissionAmount,
      netAmount,
    };
  });

  return {
    stats: {
      totalPlatformRevenue,
      totalGrossVolume,
      totalEscrowed,
      totalPendingRelease,
      totalReleased,
      totalRefunded,
      estimatedCommission: totalPlatformRevenue,
      commissionRate,
    },
    meta: {
      page,
      limit,
      total,
    },
    data,
  };
};

export const PaymentService = {
  getSenderPaymentsSummary,
  getTravelerEarningsSummary,
  handlePaymentSuccess,
  handlePaymentFailureOrExpiration,
  releasePayment,
  getAdminPayments,
};

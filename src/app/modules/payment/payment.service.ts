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
  RefundInitiator,
} from "../../../generated/prisma/enums";
import { ShipmentStepService } from "../shipment/shipment-step.service";
import { OfferService } from "../offer/offer.service";
import { NotificationService } from "../notification/notification.service";

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
  let pendingRefundAmount = 0;
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
    } else if (tx.status === PaymentStatus.PENDING_REFUND) {
      pendingRefundAmount += tx.grossAmount;
    } else if (tx.status === PaymentStatus.REFUNDED) {
      refundedAmount += tx.grossAmount;
    }
  });

  return {
    stats: {
      totalSpent,
      pendingAmount,
      pendingRefundAmount,
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

  // Fetch sender refunded transactions for this user
  const refundedSenderTransactions = await prisma.paymentTransaction.findMany({
    where: {
      senderId: userId,
      status: PaymentStatus.REFUNDED,
    },
  });

  let totalSenderRefunded = 0;
  refundedSenderTransactions.forEach((tx) => {
    totalSenderRefunded +=
      tx.refundableAmount > 0 ? tx.refundableAmount : tx.grossAmount;
  });

  // Fetch withdrawal requests by user
  const withdrawalRequests = await prisma.withdrawalRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  let awaitingPayout = 0;
  let totalWithdrawn = 0;

  withdrawalRequests.forEach((req) => {
    if (req.status === WithdrawalStatus.PENDING) {
      awaitingPayout += req.amount;
    } else if (req.status === WithdrawalStatus.APPROVED) {
      totalWithdrawn += req.amount;
    }
  });

  const availableForWithdrawal = Math.max(
    0,
    totalEarnings + totalSenderRefunded - totalWithdrawn - awaitingPayout,
  );

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

    // 6. Expire any other pending offers on this trip that no longer fit in remaining capacity
    await OfferService.expireIneligibleOffersForTrip(
      paymentTx.offer.tripId,
      tx,
    );

    // 7. Notify traveler & sender
    await NotificationService.createNotification({
      userId: paymentTx.travellerId,
      title: "Payment Received in Escrow",
      message: `Payment of $${paymentTx.grossAmount} for shipment "${paymentTx.shipment.itemName}" is held in escrow. You may now pick up the item.`,
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
      include: {
        shipment: {
          include: {
            shipmentSteps: {
              where: { stage: "DELIVERED" },
            },
          },
        },
      },
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

    if (paymentTx.shipment.status !== ShipmentStatus.DELIVERED) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Payment can only be released after the shipment has been delivered",
      );
    }

    const deliveredStep = paymentTx.shipment.shipmentSteps?.[0];
    const deliveryTime = deliveredStep?.completedAt
      ? new Date(deliveredStep.completedAt).getTime()
      : new Date(paymentTx.shipment.updatedAt).getTime();

    const HOLD_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() - deliveryTime < HOLD_PERIOD_MS) {
      const releaseEligibleDate = new Date(
        deliveryTime + HOLD_PERIOD_MS,
      ).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Payment can only be released 3 days after delivery. Release eligible on ${releaseEligibleDate}`,
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

    await NotificationService.createNotification({
      userId: paymentTx.travellerId,
      title: "Earnings Released",
      message: `Your earnings of $${paymentTx.grossAmount} for shipment "${paymentTx.shipment.itemName}" have been verified and released!`,
    });

    return updated;
  });
};

export interface CalculateRefundParams {
  grossAmount: number;
  commissionRate: number;
  initiator: "SENDER" | "TRAVELLER" | "ADMIN";
  customFeeType?: "COMMISSION" | "PERCENT" | "FLAT" | "NONE";
  customFeeValue?: number;
}

export function calculateRefundAmounts(params: CalculateRefundParams): {
  cancellationFeeAmount: number;
  refundableAmount: number;
} {
  const {
    grossAmount,
    commissionRate,
    initiator,
    customFeeType,
    customFeeValue,
  } = params;

  if (initiator === "TRAVELLER" || customFeeType === "NONE") {
    return { cancellationFeeAmount: 0, refundableAmount: grossAmount };
  }

  if (initiator === "SENDER" || customFeeType === "COMMISSION") {
    const fee = grossAmount * (commissionRate || 0.3);
    return { cancellationFeeAmount: fee, refundableAmount: grossAmount - fee };
  }

  if (
    initiator === "ADMIN" &&
    customFeeType === "PERCENT" &&
    customFeeValue !== undefined
  ) {
    const fee = grossAmount * (customFeeValue / 100);
    return {
      cancellationFeeAmount: fee,
      refundableAmount: Math.max(0, grossAmount - fee),
    };
  }

  if (
    initiator === "ADMIN" &&
    customFeeType === "FLAT" &&
    customFeeValue !== undefined
  ) {
    const fee = Math.min(grossAmount, customFeeValue);
    return { cancellationFeeAmount: fee, refundableAmount: grossAmount - fee };
  }

  const fee = grossAmount * (commissionRate || 0.3);
  return { cancellationFeeAmount: fee, refundableAmount: grossAmount - fee };
}

const markPaymentAsPendingRefund = async (
  shipmentId: string,
  reason: string,
  initiator: RefundInitiator = RefundInitiator.SENDER,
  customFee?: {
    feeType?: "COMMISSION" | "PERCENT" | "FLAT" | "NONE";
    feeValue?: number;
  },
  dbTx?: Prisma.TransactionClient,
) => {
  const client = dbTx || prisma;

  const paymentTx = await client.paymentTransaction.findUnique({
    where: { shipmentId },
    include: { shipment: true },
  });

  if (!paymentTx) return null;

  if (
    paymentTx.status === PaymentStatus.ESCROWED ||
    paymentTx.status === PaymentStatus.PENDING_RELEASE
  ) {
    const primaryPaymentMethod =
      (await client.paymentMethod.findFirst({
        where: { userId: paymentTx.senderId, isPrimary: true },
      })) ||
      (await client.paymentMethod.findFirst({
        where: { userId: paymentTx.senderId },
        orderBy: { createdAt: "desc" },
      }));

    const refundMethodDetails = primaryPaymentMethod
      ? {
          id: primaryPaymentMethod.id,
          type: primaryPaymentMethod.type,
          accountName: primaryPaymentMethod.accountName,
          accountNumber: primaryPaymentMethod.accountNumber,
          bankName: primaryPaymentMethod.bankName,
          branchName: primaryPaymentMethod.branchName,
          routingNumber: primaryPaymentMethod.routingNumber,
          cryptoAddress: primaryPaymentMethod.cryptoAddress,
        }
      : null;

    const { cancellationFeeAmount, refundableAmount } = calculateRefundAmounts({
      grossAmount: paymentTx.grossAmount,
      commissionRate: paymentTx.commissionRate,
      initiator: initiator as any,
      customFeeType: customFee?.feeType,
      customFeeValue: customFee?.feeValue,
    });

    const updated = await client.paymentTransaction.update({
      where: { id: paymentTx.id },
      data: {
        status: PaymentStatus.PENDING_REFUND,
        refundReason: reason,
        refundInitiator: initiator,
        cancellationFeeAmount,
        refundableAmount,
        refundMethodDetails: refundMethodDetails as any,
      },
    });

    await NotificationService.createNotification({
      userId: paymentTx.senderId,
      title: "Refund Pending",
      message: `Your payment of $${refundableAmount.toFixed(2)} for shipment "${paymentTx.shipment?.itemName || "item"}" is pending refund.${cancellationFeeAmount > 0 ? ` Cancellation fee retained: $${cancellationFeeAmount.toFixed(2)}.` : ""}`,
    });

    return updated;
  } else if (paymentTx.status === PaymentStatus.PENDING_PAYMENT) {
    return client.paymentTransaction.update({
      where: { id: paymentTx.id },
      data: { status: PaymentStatus.FAILED },
    });
  }

  return paymentTx;
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
      refundableAmount: true,
      cancellationFeeAmount: true,
      status: true,
    },
  });

  let totalPlatformRevenue = 0;
  let totalGrossVolume = 0;
  let totalEscrowed = 0;
  let totalPendingRelease = 0;
  let totalPendingRefund = 0;
  let totalReleased = 0;
  let totalRefunded = 0;

  allTxns.forEach((tx) => {
    const commission =
      tx.commissionAmount > 0
        ? tx.commissionAmount
        : tx.grossAmount * (tx.commissionRate || 0.3);
    const net = tx.netAmount > 0 ? tx.netAmount : tx.grossAmount - commission;
    const refundable =
      tx.refundableAmount > 0 ? tx.refundableAmount : tx.grossAmount;
    const cancellationFee = tx.cancellationFeeAmount || 0;

    if (
      tx.status === PaymentStatus.ESCROWED ||
      tx.status === PaymentStatus.PENDING_RELEASE ||
      tx.status === PaymentStatus.RELEASED
    ) {
      totalGrossVolume += tx.grossAmount;
    }

    if (
      tx.status === PaymentStatus.PENDING_RELEASE ||
      tx.status === PaymentStatus.RELEASED
    ) {
      totalPlatformRevenue += commission;
    } else if (
      tx.status === PaymentStatus.PENDING_REFUND ||
      tx.status === PaymentStatus.REFUNDED
    ) {
      totalPlatformRevenue += cancellationFee;
    }

    if (tx.status === PaymentStatus.ESCROWED) {
      totalEscrowed += tx.grossAmount;
    } else if (tx.status === PaymentStatus.PENDING_RELEASE) {
      totalPendingRelease += tx.grossAmount;
    } else if (tx.status === PaymentStatus.PENDING_REFUND) {
      totalPendingRefund += refundable;
    } else if (tx.status === PaymentStatus.RELEASED) {
      totalReleased += net;
    } else if (tx.status === PaymentStatus.REFUNDED) {
      totalRefunded += refundable;
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
      totalPendingRefund,
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

const getPendingRefunds = async (query: GetAdminPaymentsQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const whereConditions: Prisma.PaymentTransactionWhereInput = {
    status: PaymentStatus.PENDING_REFUND,
  };

  if (query.search) {
    const s = query.search.trim();
    whereConditions.OR = [
      { transactionId: { contains: s, mode: "insensitive" } },
      { shipment: { itemName: { contains: s, mode: "insensitive" } } },
      { sender: { name: { contains: s, mode: "insensitive" } } },
      { sender: { email: { contains: s, mode: "insensitive" } } },
    ];
  }

  const transactions = await prisma.paymentTransaction.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { updatedAt: "desc" },
    include: {
      shipment: {
        select: {
          id: true,
          itemName: true,
          status: true,
          weight: true,
        },
      },
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
          paymentMethods: true,
        },
      },
      traveller: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  const total = await prisma.paymentTransaction.count({
    where: whereConditions,
  });

  return {
    meta: { page, limit, total },
    data: transactions,
  };
};

interface ProcessAdminRefundPayload {
  refundTxnId: string;
  adminNotes?: string;
  proofPhotoUrl?: string;
}

const processAdminRefund = async (
  transactionId: string,
  payload: ProcessAdminRefundPayload,
  adminUser: User,
) => {
  if (adminUser.role !== "admin") {
    throw new ApiError(httpStatus.FORBIDDEN, "Only admin can process refunds");
  }

  if (!payload.refundTxnId || !payload.refundTxnId.trim()) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Refund transaction ID is required",
    );
  }

  return prisma.$transaction(async (tx) => {
    const paymentTx = await tx.paymentTransaction.findFirst({
      where: {
        OR: [{ transactionId }, { id: transactionId }],
      },
      include: { shipment: true },
    });

    if (!paymentTx) {
      throw new ApiError(httpStatus.NOT_FOUND, "Payment transaction not found");
    }

    if (paymentTx.status === PaymentStatus.REFUNDED) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Payment is already refunded");
    }

    if (
      paymentTx.status !== PaymentStatus.PENDING_REFUND &&
      paymentTx.status !== PaymentStatus.ESCROWED &&
      paymentTx.status !== PaymentStatus.PENDING_RELEASE
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot process refund for transaction with status ${paymentTx.status}`,
      );
    }

    const finalRefundableAmount =
      paymentTx.refundableAmount > 0
        ? paymentTx.refundableAmount
        : paymentTx.grossAmount;

    const updated = await tx.paymentTransaction.update({
      where: { id: paymentTx.id },
      data: {
        status: PaymentStatus.REFUNDED,
        refundableAmount: finalRefundableAmount,
        refundTxnId: payload.refundTxnId,
        adminRefundNotes: payload.adminNotes,
        ...(payload.proofPhotoUrl && { proofPhotoUrl: payload.proofPhotoUrl }),
        refundedAt: new Date(),
        refundedBy: adminUser.id,
      },
    });

    await NotificationService.createNotification({
      userId: paymentTx.senderId,
      title: "Refund Processed",
      message: `Your refund of $${finalRefundableAmount.toFixed(2)} for shipment "${paymentTx.shipment?.itemName || "item"}" has been processed. Reference ID: ${payload.refundTxnId}`,
    });

    return updated;
  });
};

interface AdminCancelShipmentPayload {
  reason: string;
  feeType?: "COMMISSION" | "PERCENT" | "FLAT" | "NONE";
  feeValue?: number;
}

const adminCancelShipment = async (
  shipmentId: string,
  payload: AdminCancelShipmentPayload,
  adminUser: User,
) => {
  if (adminUser.role !== "admin") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only admins can perform admin cancellations",
    );
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
  });

  if (!shipment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  if (shipment.status === ShipmentStatus.CANCELED) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Shipment is already canceled");
  }

  const paymentTx = await prisma.paymentTransaction.findUnique({
    where: { shipmentId },
  });

  const grossAmount = paymentTx?.grossAmount || 0;
  const commissionRate = paymentTx?.commissionRate || 0.3;
  const maxCommissionPercent = Math.round(commissionRate * 100);
  const maxCommissionAmount =
    paymentTx?.commissionAmount && paymentTx.commissionAmount > 0
      ? paymentTx.commissionAmount
      : grossAmount * commissionRate;

  if (payload.feeType === "PERCENT") {
    const val = payload.feeValue ?? 0;
    if (val < 1 || val > maxCommissionPercent) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Fee percentage must be between 1% and ${maxCommissionPercent}%`,
      );
    }
  }

  if (payload.feeType === "FLAT") {
    const val = payload.feeValue ?? 0;
    const maxFlat = Math.max(1, maxCommissionAmount);
    if (val < 1 || val > maxFlat) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Flat fee amount must be between $1.00 and $${maxFlat.toFixed(2)}`,
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id: shipmentId },
      data: { status: ShipmentStatus.CANCELED },
    });

    if (shipment.tripId && shipment.bagType) {
      const weight = shipment.weight;
      if (shipment.bagType === "cabin") {
        await tx.trip.update({
          where: { id: shipment.tripId },
          data: { remainingCabinCapacity: { increment: weight } },
        });
      } else {
        await tx.trip.update({
          where: { id: shipment.tripId },
          data: { remainingCheckInCapacity: { increment: weight } },
        });
      }
    }

    const updatedTx = await markPaymentAsPendingRefund(
      shipmentId,
      payload.reason || "Admin canceled shipment",
      RefundInitiator.ADMIN,
      { feeType: payload.feeType, feeValue: payload.feeValue },
      tx,
    );

    await tx.offer.updateMany({
      where: {
        shipmentId,
        status: {
          in: [
            OfferStatus.ACCEPTED,
            OfferStatus.PENDING,
            OfferStatus.PAYMENT_PENDING,
          ],
        },
      },
      data: { status: OfferStatus.EXPIRED },
    });

    return updatedTx;
  });
};

export const PaymentService = {
  getSenderPaymentsSummary,
  getTravelerEarningsSummary,
  handlePaymentSuccess,
  handlePaymentFailureOrExpiration,
  releasePayment,
  markPaymentAsPendingRefund,
  getAdminPayments,
  getPendingRefunds,
  processAdminRefund,
  adminCancelShipment,
};

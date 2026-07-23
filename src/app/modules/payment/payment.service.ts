import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { User } from "../../lib/auth";
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
  // Fetch system commission rate setting (default 30% = 0.30)
  const commissionSetting = await prisma.systemSetting.findUnique({
    where: { key: "WITHDRAWAL_COMMISSION_RATE" },
  });
  const commissionRate = commissionSetting
    ? parseFloat(commissionSetting.value)
    : 0.3;

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

  // Calculate earnings
  let totalEarnings = 0;
  let pendingReleaseEarnings = 0;

  transactions.forEach((tx) => {
    if (tx.status === PaymentStatus.RELEASED) {
      totalEarnings += tx.grossAmount;
    } else if (
      tx.status === PaymentStatus.ESCROWED ||
      tx.status === PaymentStatus.PENDING_RELEASE
    ) {
      pendingReleaseEarnings += tx.grossAmount;
    }
  });

  // Fetch withdrawal requests by traveler
  const withdrawalRequests = await prisma.withdrawalRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  let awaitingPayout = 0;
  let totalWithdrawnGross = 0;

  withdrawalRequests.forEach((req) => {
    if (req.status === WithdrawalStatus.PENDING) {
      awaitingPayout += req.netAmount;
      totalWithdrawnGross += req.grossAmount;
    } else if (req.status === WithdrawalStatus.APPROVED) {
      totalWithdrawnGross += req.grossAmount;
    }
  });

  const availableForWithdrawal = Math.max(
    0,
    totalEarnings - totalWithdrawnGross,
  );

  return {
    stats: {
      totalEarnings,
      pendingReleaseEarnings,
      awaitingPayout,
      disputeAmount: 0,
      availableForWithdrawal,
      commissionRate,
      commissionPercentage: Math.round(commissionRate * 100),
    },
    earningsHistory: transactions.map((tx) => {
      const commAmount = tx.grossAmount * commissionRate;
      const netAmount = tx.grossAmount - commAmount;
      return {
        ...tx,
        commissionAmount: commAmount,
        netAmount,
      };
    }),
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

export const PaymentService = {
  getSenderPaymentsSummary,
  getTravelerEarningsSummary,
  handlePaymentSuccess,
  handlePaymentFailureOrExpiration,
  releasePayment,
};

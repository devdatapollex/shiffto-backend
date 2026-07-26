import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { User } from "../../lib/auth";
import { WithdrawalStatus } from "../../../generated/prisma/enums";
import { PaymentService } from "../payment/payment.service";

export interface RequestWithdrawalPayload {
  amount?: number;
  grossAmount?: number;
  paymentMethodId: string;
}

const requestWithdrawal = async (
  userId: string,
  payload: RequestWithdrawalPayload,
) => {
  const withdrawAmount = payload.amount ?? payload.grossAmount ?? 0;
  if (withdrawAmount <= 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Withdrawal amount must be greater than zero",
    );
  }

  return prisma.$transaction(async (tx) => {
    // 1. Calculate available balance
    const travelerSummary =
      await PaymentService.getTravelerEarningsSummary(userId);
    if (travelerSummary.stats.availableForWithdrawal < withdrawAmount) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Insufficient available funds. Available: $${travelerSummary.stats.availableForWithdrawal.toFixed(2)}, Requested: $${withdrawAmount.toFixed(2)}`,
      );
    }

    // 2. Fetch payment method
    const paymentMethod = await tx.paymentMethod.findUnique({
      where: { id: payload.paymentMethodId },
    });

    if (!paymentMethod || paymentMethod.userId !== userId) {
      throw new ApiError(httpStatus.NOT_FOUND, "Payment method not found");
    }

    // 3. Generate unique withdrawal number (WDR-xxx)
    const count = await tx.withdrawalRequest.count();
    const withdrawalNo = `WDR-${String(count + 1).padStart(3, "0")}`;

    // 4. Create WithdrawalRequest
    const withdrawal = await tx.withdrawalRequest.create({
      data: {
        withdrawalNo,
        userId,
        amount: withdrawAmount,
        paymentMethodId: paymentMethod.id,
        paymentMethodDetails: {
          type: paymentMethod.type,
          accountName: paymentMethod.accountName,
          accountNumber: paymentMethod.accountNumber,
          bankName: paymentMethod.bankName,
          branchName: paymentMethod.branchName,
          routingNumber: paymentMethod.routingNumber,
          cryptoAddress: paymentMethod.cryptoAddress,
        },
        status: WithdrawalStatus.PENDING,
      },
    });

    // 5. Create notification
    await tx.notification.create({
      data: {
        userId,
        title: "Withdrawal Request Submitted",
        message: `Your withdrawal request ${withdrawalNo} for $${withdrawAmount.toFixed(2)} has been submitted for admin processing.`,
      },
    });

    return withdrawal;
  });
};

const getTravelerWithdrawals = async (userId: string) => {
  return prisma.withdrawalRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

const getAllWithdrawals = async (
  adminUser: User,
  statusFilter?: WithdrawalStatus,
) => {
  if (adminUser.role !== "admin") {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
  }

  return prisma.withdrawalRequest.findMany({
    where: {
      ...(statusFilter && { status: statusFilter }),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

const approveWithdrawal = async (
  withdrawalId: string,
  payoutTxnId: string,
  adminUser: User,
) => {
  if (adminUser.role !== "admin") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only admin can approve withdrawals",
    );
  }

  if (!payoutTxnId || payoutTxnId.trim() === "") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Payout transaction ID (reference number) is required",
    );
  }

  return prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new ApiError(httpStatus.NOT_FOUND, "Withdrawal request not found");
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot approve withdrawal with status ${withdrawal.status}`,
      );
    }

    const updated = await tx.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.APPROVED,
        payoutTxnId,
        processedAt: new Date(),
        processedBy: adminUser.id,
      },
    });

    await tx.notification.create({
      data: {
        userId: withdrawal.userId,
        title: "Withdrawal Approved & Transferred",
        message: `Your withdrawal request ${withdrawal.withdrawalNo} of $${withdrawal.amount.toFixed(2)} has been transferred! Txn Ref: ${payoutTxnId}`,
      },
    });

    return updated;
  });
};

const rejectWithdrawal = async (
  withdrawalId: string,
  rejectionReason: string,
  adminUser: User,
) => {
  if (adminUser.role !== "admin") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only admin can reject withdrawals",
    );
  }

  return prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new ApiError(httpStatus.NOT_FOUND, "Withdrawal request not found");
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot reject withdrawal with status ${withdrawal.status}`,
      );
    }

    const updated = await tx.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.REJECTED,
        rejectionReason: rejectionReason || "Insufficient verification",
        processedAt: new Date(),
        processedBy: adminUser.id,
      },
    });

    await tx.notification.create({
      data: {
        userId: withdrawal.userId,
        title: "Withdrawal Request Rejected",
        message: `Your withdrawal request ${withdrawal.withdrawalNo} was rejected. Reason: ${rejectionReason || "Please verify your payment details"}. Your funds have been unlocked back to your balance.`,
      },
    });

    return updated;
  });
};

export const WithdrawalService = {
  requestWithdrawal,
  getTravelerWithdrawals,
  getAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
};

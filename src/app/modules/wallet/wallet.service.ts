import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { PaymentMethodType } from "../../../generated/prisma/enums";

export interface CreatePaymentMethodPayload {
  type: PaymentMethodType;
  accountName?: string;
  accountNumber: string;
  bankName?: string;
  branchName?: string;
  routingNumber?: string;
  cryptoAddress?: string;
  isPrimary?: boolean;
}

const getUserPaymentMethods = async (userId: string) => {
  return prisma.paymentMethod.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

const addPaymentMethod = async (
  userId: string,
  payload: CreatePaymentMethodPayload,
) => {
  return prisma.$transaction(async (tx) => {
    const existingCount = await tx.paymentMethod.count({ where: { userId } });
    const shouldBePrimary = payload.isPrimary || existingCount === 0;

    if (shouldBePrimary) {
      await tx.paymentMethod.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });
    }

    return tx.paymentMethod.create({
      data: {
        userId,
        type: payload.type,
        accountName: payload.accountName,
        accountNumber: payload.accountNumber,
        bankName: payload.bankName,
        branchName: payload.branchName,
        routingNumber: payload.routingNumber,
        cryptoAddress: payload.cryptoAddress,
        isPrimary: shouldBePrimary,
      },
    });
  });
};

const updatePaymentMethod = async (
  userId: string,
  methodId: string,
  payload: Partial<CreatePaymentMethodPayload>,
) => {
  return prisma.$transaction(async (tx) => {
    const method = await tx.paymentMethod.findUnique({
      where: { id: methodId },
    });

    if (!method || method.userId !== userId) {
      throw new ApiError(httpStatus.NOT_FOUND, "Payment method not found");
    }

    if (payload.isPrimary) {
      await tx.paymentMethod.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });
    }

    return tx.paymentMethod.update({
      where: { id: methodId },
      data: {
        ...(payload.type && { type: payload.type }),
        ...(payload.accountName !== undefined && { accountName: payload.accountName }),
        ...(payload.accountNumber && { accountNumber: payload.accountNumber }),
        ...(payload.bankName !== undefined && { bankName: payload.bankName }),
        ...(payload.branchName !== undefined && { branchName: payload.branchName }),
        ...(payload.routingNumber !== undefined && { routingNumber: payload.routingNumber }),
        ...(payload.cryptoAddress !== undefined && { cryptoAddress: payload.cryptoAddress }),
        ...(payload.isPrimary !== undefined && { isPrimary: payload.isPrimary }),
      },
    });
  });
};

const deletePaymentMethod = async (userId: string, methodId: string) => {
  const method = await prisma.paymentMethod.findUnique({
    where: { id: methodId },
  });

  if (!method || method.userId !== userId) {
    throw new ApiError(httpStatus.NOT_FOUND, "Payment method not found");
  }

  await prisma.paymentMethod.delete({ where: { id: methodId } });
  return { message: "Payment method deleted successfully" };
};

const setPrimaryPaymentMethod = async (userId: string, methodId: string) => {
  return prisma.$transaction(async (tx) => {
    const method = await tx.paymentMethod.findUnique({
      where: { id: methodId },
    });

    if (!method || method.userId !== userId) {
      throw new ApiError(httpStatus.NOT_FOUND, "Payment method not found");
    }

    await tx.paymentMethod.updateMany({
      where: { userId },
      data: { isPrimary: false },
    });

    return tx.paymentMethod.update({
      where: { id: methodId },
      data: { isPrimary: true },
    });
  });
};

export const WalletService = {
  getUserPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  setPrimaryPaymentMethod,
};

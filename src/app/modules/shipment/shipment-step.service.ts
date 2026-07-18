import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { User } from "../../lib/auth";
import { ShipmentStep, Prisma } from "../../../generated/prisma/client";
import {
  ShipmentStatus,
  shipmentStepStage,
} from "../../../generated/prisma/enums";

const confirmPayment = async (
  shipmentId: string,
  user: User,
  tx?: Prisma.TransactionClient,
) => {
  const client = tx || prisma;

  const shipment = await client.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      shipmentSteps: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!shipment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  if (user.role !== "admin" && shipment.userId !== user.id) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
  }

  if (shipment.status !== ShipmentStatus.AWAITING_MATCH) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Shipment is not in AWAITING_MATCH status",
    );
  }

  const paymentStep = shipment.shipmentSteps.find(
    (s: ShipmentStep) => s.stage === shipmentStepStage.PAYMENT_CONFIRMED,
  );
  const pickupStep = shipment.shipmentSteps.find(
    (s: ShipmentStep) => s.stage === shipmentStepStage.PICKED_UP,
  );

  if (!paymentStep || !pickupStep) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Shipment steps not properly initialized",
    );
  }

  if (paymentStep.completedAt) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Payment already confirmed");
  }

  const executeUpdates = async (
    transactionClient: Prisma.TransactionClient,
  ) => {
    await transactionClient.shipmentStep.update({
      where: { id: paymentStep.id },
      data: {
        completedAt: new Date(),
        isCurrent: false,
      },
    });

    await transactionClient.shipmentStep.update({
      where: { id: pickupStep.id },
      data: { isCurrent: true },
    });

    await transactionClient.shipment.update({
      where: { id: shipmentId },
      data: { status: ShipmentStatus.ACTIVE },
    });

    return transactionClient.shipmentStep.findMany({
      where: { shipmentId },
      include: { definition: true },
      orderBy: { order: "asc" },
    });
  };

  if (tx) {
    return executeUpdates(tx);
  } else {
    return prisma.$transaction(async (newTx) => {
      return executeUpdates(newTx);
    });
  }
};

const advanceStep = async (
  shipmentId: string,
  user: User,
  options?: { notes?: string; photoUrl?: string },
  tx?: Prisma.TransactionClient,
) => {
  const client = tx || prisma;

  const shipment = await client.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      shipmentSteps: {
        orderBy: { order: "asc" },
      },
      trip: true,
    },
  });

  if (!shipment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  if (
    user.role !== "admin" &&
    shipment.userId !== user.id &&
    (!shipment.trip || shipment.trip.userId !== user.id)
  ) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
  }

  if (shipment.status === ShipmentStatus.CANCELED) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot advance steps for a canceled shipment",
    );
  }

  if (shipment.status === ShipmentStatus.DELIVERED) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Shipment is already delivered");
  }

  const currentStep = shipment.shipmentSteps.find(
    (s: ShipmentStep) => s.isCurrent,
  );

  if (!currentStep) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "No current step found. Confirm payment first.",
    );
  }

  if (currentStep.stage === shipmentStepStage.DELIVERED) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Shipment is already at the final step",
    );
  }

  const nextStep = shipment.shipmentSteps.find(
    (s: ShipmentStep) => s.order === currentStep.order + 1,
  );

  if (!nextStep) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "No next step available. Shipment is at the final step.",
    );
  }

  const executeUpdates = async (
    transactionClient: Prisma.TransactionClient,
  ) => {
    await transactionClient.shipmentStep.update({
      where: { id: currentStep.id },
      data: {
        isCurrent: false,
        completedAt: new Date(),
        ...(options?.notes && { notes: options.notes }),
        ...(options?.photoUrl && { photoUrl: options.photoUrl }),
      },
    });

    await transactionClient.shipmentStep.update({
      where: { id: nextStep.id },
      data: { isCurrent: true },
    });

    if (nextStep.stage === shipmentStepStage.DELIVERED) {
      await transactionClient.shipment.update({
        where: { id: shipmentId },
        data: { status: ShipmentStatus.DELIVERED },
      });
    }

    return transactionClient.shipmentStep.findMany({
      where: { shipmentId },
      include: { definition: true },
      orderBy: { order: "asc" },
    });
  };

  if (tx) {
    return executeUpdates(tx);
  } else {
    return prisma.$transaction(async (newTx) => {
      return executeUpdates(newTx);
    });
  }
};

export const ShipmentStepService = {
  confirmPayment,
  advanceStep,
};

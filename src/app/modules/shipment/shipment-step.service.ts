import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { User } from "../../lib/auth";

const confirmPayment = async (shipmentId: string, user: User) => {
  const shipment = await prisma.shipment.findUnique({
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

  if (shipment.status !== "AWAITING_MATCH") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Shipment is not in AWAITING_MATCH status",
    );
  }

  const paymentStep = shipment.shipmentSteps.find(
    (s) => s.stage === "PAYMENT_CONFIRMED",
  );
  const pickupStep = shipment.shipmentSteps.find(
    (s) => s.stage === "PICKED_UP",
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

  const result = await prisma.$transaction(async (tx) => {
    await tx.shipmentStep.update({
      where: { id: paymentStep.id },
      data: { completedAt: new Date() },
    });

    await tx.shipmentStep.update({
      where: { id: pickupStep.id },
      data: { isCurrent: true },
    });

    await tx.shipment.update({
      where: { id: shipmentId },
      data: { status: "ACTIVE" },
    });

    return tx.shipmentStep.findMany({
      where: { shipmentId },
      include: { definition: true },
      orderBy: { order: "asc" },
    });
  });

  return result;
};

const advanceStep = async (
  shipmentId: string,
  user: User,
  options?: { notes?: string; photoUrl?: string },
) => {
  const shipment = await prisma.shipment.findUnique({
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

  if (shipment.status === "CANCELED") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot advance steps for a canceled shipment",
    );
  }

  if (shipment.status === "DELIVERED") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Shipment is already delivered");
  }

  const currentStep = shipment.shipmentSteps.find((s) => s.isCurrent);

  if (!currentStep) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "No current step found. Confirm payment first.",
    );
  }

  if (currentStep.stage === "DELIVERED") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Shipment is already at the final step",
    );
  }

  const nextStep = shipment.shipmentSteps.find(
    (s) => s.order === currentStep.order + 1,
  );

  if (!nextStep) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "No next step available. Shipment is at the final step.",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.shipmentStep.update({
      where: { id: currentStep.id },
      data: {
        isCurrent: false,
        completedAt: new Date(),
        ...(options?.notes && { notes: options.notes }),
        ...(options?.photoUrl && { photoUrl: options.photoUrl }),
      },
    });

    await tx.shipmentStep.update({
      where: { id: nextStep.id },
      data: { isCurrent: true },
    });

    if (nextStep.stage === "DELIVERED") {
      await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: "DELIVERED" },
      });
    }

    return tx.shipmentStep.findMany({
      where: { shipmentId },
      include: { definition: true },
      orderBy: { order: "asc" },
    });
  });

  return result;
};

export const ShipmentStepService = {
  confirmPayment,
  advanceStep,
};

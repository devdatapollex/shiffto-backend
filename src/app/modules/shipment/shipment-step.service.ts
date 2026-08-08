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

/**
 * Common internal step advancement helper that enforces invariant stage checks,
 * role authorization, and atomic transactions.
 */
const executeStepAdvancement = async (
  shipmentId: string,
  user: User,
  expectedStage: shipmentStepStage,
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

  const isTraveller = Boolean(
    shipment.trip && shipment.trip.userId === user.id,
  );
  const isAdmin = user.role === "admin";

  if (!isTraveller && !isAdmin) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only the assigned traveller or admin can advance shipment steps",
    );
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

  if (currentStep.stage !== expectedStage) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot confirm stage ${expectedStage}. Current active stage is ${currentStep.stage}.`,
    );
  }

  const isFinalStep = currentStep.stage === shipmentStepStage.DELIVERED;
  const nextStep = shipment.shipmentSteps.find(
    (s: ShipmentStep) => s.order === currentStep.order + 1,
  );

  if (!isFinalStep && !nextStep) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No next step available.");
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

    if (nextStep) {
      await transactionClient.shipmentStep.update({
        where: { id: nextStep.id },
        data: { isCurrent: true },
      });
    }

    if (isFinalStep) {
      await transactionClient.shipment.update({
        where: { id: shipmentId },
        data: { status: ShipmentStatus.DELIVERED },
      });

      // Transition PaymentTransaction from ESCROWED to PENDING_RELEASE with proof photo
      await transactionClient.paymentTransaction.updateMany({
        where: {
          shipmentId,
          status: "ESCROWED",
        },
        data: {
          status: "PENDING_RELEASE",
          ...(options?.photoUrl && { proofPhotoUrl: options.photoUrl }),
        },
      });

      // Auto-complete trip if all assigned shipments are delivered
      if (shipment.tripId) {
        const remainingUndelivered = await transactionClient.shipment.count({
          where: {
            tripId: shipment.tripId,
            id: { not: shipmentId },
            status: { not: ShipmentStatus.DELIVERED },
          },
        });
        if (remainingUndelivered === 0) {
          await transactionClient.trip.update({
            where: { id: shipment.tripId },
            data: { status: "COMPLETED" },
          });
        }
      }
    } else if (shipment.tripId) {
      if (currentStep.stage === shipmentStepStage.CHECKED_IN) {
        const trip = await transactionClient.trip.findUnique({
          where: { id: shipment.tripId },
        });
        if (trip && trip.status === "ACTIVE") {
          await transactionClient.trip.update({
            where: { id: trip.id },
            data: { status: "IN_TRANSIT" },
          });
        }
      } else if (
        currentStep.stage === shipmentStepStage.ARRIVED_AT_DESTINATION
      ) {
        const trip = await transactionClient.trip.findUnique({
          where: { id: shipment.tripId },
        });
        if (
          trip &&
          (trip.status === "ACTIVE" || trip.status === "IN_TRANSIT")
        ) {
          await transactionClient.trip.update({
            where: { id: trip.id },
            data: { status: "ARRIVED" },
          });
        }
      }
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

// Dedicated step advancement service functions
const confirmPickup = async (
  shipmentId: string,
  user: User,
  payload: { photoUrl: string; notes?: string },
  tx?: Prisma.TransactionClient,
) => {
  return executeStepAdvancement(
    shipmentId,
    user,
    shipmentStepStage.PICKED_UP,
    payload,
    tx,
  );
};

const confirmCheckin = async (
  shipmentId: string,
  user: User,
  payload?: { notes?: string },
  tx?: Prisma.TransactionClient,
) => {
  return executeStepAdvancement(
    shipmentId,
    user,
    shipmentStepStage.CHECKED_IN,
    payload,
    tx,
  );
};

const confirmTransit = async (
  shipmentId: string,
  user: User,
  payload?: { notes?: string },
  tx?: Prisma.TransactionClient,
) => {
  return executeStepAdvancement(
    shipmentId,
    user,
    shipmentStepStage.IN_TRANSIT,
    payload,
    tx,
  );
};

const confirmArrival = async (
  shipmentId: string,
  user: User,
  payload?: { notes?: string },
  tx?: Prisma.TransactionClient,
) => {
  return executeStepAdvancement(
    shipmentId,
    user,
    shipmentStepStage.ARRIVED_AT_DESTINATION,
    payload,
    tx,
  );
};

const confirmOutForDelivery = async (
  shipmentId: string,
  user: User,
  payload?: { notes?: string },
  tx?: Prisma.TransactionClient,
) => {
  return executeStepAdvancement(
    shipmentId,
    user,
    shipmentStepStage.OUT_FOR_DELIVERY,
    payload,
    tx,
  );
};

const confirmDelivery = async (
  shipmentId: string,
  user: User,
  payload: { photoUrl: string; notes?: string },
  tx?: Prisma.TransactionClient,
) => {
  return executeStepAdvancement(
    shipmentId,
    user,
    shipmentStepStage.DELIVERED,
    payload,
    tx,
  );
};

// Generic advance step override (used for admin override if stage isn't pre-asserted)
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
      shipmentSteps: { orderBy: { order: "asc" } },
      trip: true,
    },
  });

  if (!shipment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  const currentStep = shipment.shipmentSteps.find((s) => s.isCurrent);
  if (!currentStep) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No current active step found");
  }

  return executeStepAdvancement(
    shipmentId,
    user,
    currentStep.stage,
    options,
    tx,
  );
};

export const ShipmentStepService = {
  confirmPayment,
  confirmPickup,
  confirmCheckin,
  confirmTransit,
  confirmArrival,
  confirmOutForDelivery,
  confirmDelivery,
  advanceStep,
};

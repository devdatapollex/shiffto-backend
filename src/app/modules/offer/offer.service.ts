import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { User } from "../../lib/auth";
import { OfferStatus, ShipmentStatus } from "../../../generated/prisma/enums";
import { z } from "zod";
import { OfferValidation } from "./offer.validation";
import { ShipmentStepService } from "../shipment/shipment-step.service";
import { getPaymentAdapter } from "../payment/payment.adapter";

const OFFER_EXPIRATION_MINUTES = 30;

const expireStaleOffers = async (shipmentId?: string) => {
  const expiryCutoff = new Date(
    Date.now() - OFFER_EXPIRATION_MINUTES * 60 * 1000,
  );

  await prisma.offer.updateMany({
    where: {
      status: { in: [OfferStatus.PENDING, OfferStatus.PAYMENT_CANCELED] },
      createdAt: { lt: expiryCutoff },
      ...(shipmentId ? { shipmentId } : {}),
    },
    data: {
      status: OfferStatus.EXPIRED,
    },
  });
};

const createOffer = async (
  payload: z.infer<typeof OfferValidation.createOfferSchema>,
  user: User,
) => {
  const { shipmentId, tripId, offeredPrice, bagType } = payload;

  // Auto-expire any stale PENDING offer for this shipment
  await expireStaleOffers(shipmentId);

  // Validate shipment exists, is AWAITING_MATCH, tripId is null
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { category: true },
  });

  if (!shipment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  if (
    shipment.status !== ShipmentStatus.AWAITING_MATCH ||
    shipment.tripId !== null
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Shipment is not available for offers",
    );
  }

  // Validate trip exists, is ACTIVE, belongs to traveller
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
  });

  if (!trip) {
    throw new ApiError(httpStatus.NOT_FOUND, "Trip not found");
  }

  if (trip.status !== "ACTIVE") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Trip is not active");
  }

  if (trip.userId !== user.id) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only make offers using your own trips",
    );
  }

  // Validate shipment route matches trip route (fromCountry/toCountry)
  if (
    shipment.fromCountry.toUpperCase() !== trip.fromCountry.toUpperCase() ||
    shipment.toCountry.toUpperCase() !== trip.toCountry.toUpperCase()
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Shipment route does not match trip route",
    );
  }

  // Validate trip has sufficient capacity for shipment weight + bagType
  const weight = shipment.weight;
  if (bagType === "cabin") {
    if (trip.remainingCabinCapacity < weight) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Insufficient cabin bag capacity. Needed: ${weight}kg, Available: ${trip.remainingCabinCapacity}kg`,
      );
    }
  } else if (bagType === "checkIn") {
    if (trip.remainingCheckInCapacity < weight) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Insufficient check-in bag capacity. Needed: ${weight}kg, Available: ${trip.remainingCheckInCapacity}kg`,
      );
    }
  } else {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Invalid bagType. Must be 'cabin' or 'checkIn'",
    );
  }

  // Fetch shipment's category, validate offeredPrice is within [minPrice, maxPrice]
  const category = shipment.category;
  if (!category) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Shipment category not found",
    );
  }

  if (offeredPrice < category.minPrice) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Offered price cannot be lower than the category minimum of $${category.minPrice}`,
    );
  }

  if (category.maxPrice !== null && offeredPrice > category.maxPrice) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Offered price cannot be higher than the category maximum of $${category.maxPrice}`,
    );
  }

  // Check no existing PENDING, PAYMENT_PENDING, PAYMENT_CANCELED, or ACCEPTED offer from this traveller for this shipment
  const existingOffer = await prisma.offer.findFirst({
    where: {
      shipmentId,
      travellerId: user.id,
      status: {
        in: [
          OfferStatus.PENDING,
          OfferStatus.PAYMENT_PENDING,
          OfferStatus.PAYMENT_CANCELED,
          OfferStatus.ACCEPTED,
        ],
      },
    },
  });

  if (existingOffer) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "You already have an active offer for this shipment",
    );
  }

  const isCounterOffer = offeredPrice !== shipment.pricePerKg;

  // Upsert Offer so previous REJECTED or EXPIRED offers are updated without unique key collision
  const offer = await prisma.offer.upsert({
    where: {
      shipmentId_travellerId: {
        shipmentId,
        travellerId: user.id,
      },
    },
    create: {
      shipmentId,
      travellerId: user.id,
      tripId,
      senderPrice: shipment.pricePerKg,
      offeredPrice,
      bagType,
      isCounterOffer,
      status: OfferStatus.PENDING,
    },
    update: {
      tripId,
      senderPrice: shipment.pricePerKg,
      offeredPrice,
      bagType,
      isCounterOffer,
      status: OfferStatus.PENDING,
      createdAt: new Date(),
    },
    include: {
      shipment: {
        include: { category: true },
      },
      trip: true,
    },
  });

  return offer;
};

const getOffersForShipment = async (shipmentId: string, user: User) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
  });

  if (!shipment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  if (shipment.userId !== user.id && user.role !== "admin") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only the shipment owner can view offers",
    );
  }

  await expireStaleOffers(shipmentId);

  const offers = await prisma.offer.findMany({
    where: { shipmentId },
    include: {
      traveller: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      trip: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return offers;
};

const getReceivedOffers = async (user: User) => {
  await expireStaleOffers();

  const offers = await prisma.offer.findMany({
    where: {
      shipment: {
        userId: user.id,
      },
      status: {
        in: [
          OfferStatus.PENDING,
          OfferStatus.PAYMENT_PENDING,
          OfferStatus.PAYMENT_CANCELED,
        ],
      },
    },
    include: {
      traveller: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      trip: true,
      shipment: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return offers;
};

const getSentOffers = async (user: User) => {
  await expireStaleOffers();

  const offers = await prisma.offer.findMany({
    where: {
      travellerId: user.id,
    },
    include: {
      shipment: {
        include: { category: true },
      },
      trip: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return offers;
};

const acceptOffer = async (offerId: string, user: User) => {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      shipment: {
        include: {
          shipmentSteps: true,
        },
      },
      trip: true,
    },
  });

  if (!offer) {
    throw new ApiError(httpStatus.NOT_FOUND, "Offer not found");
  }

  if (
    offer.status !== OfferStatus.PENDING &&
    offer.status !== OfferStatus.PAYMENT_PENDING &&
    offer.status !== OfferStatus.PAYMENT_CANCELED
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Only pending, payment pending, or payment canceled offers can be accepted. Current status: ${offer.status}`,
    );
  }

  if (
    offer.status === OfferStatus.PENDING ||
    offer.status === OfferStatus.PAYMENT_CANCELED
  ) {
    const isExpired =
      Date.now() - new Date(offer.createdAt).getTime() >
      OFFER_EXPIRATION_MINUTES * 60 * 1000;

    if (isExpired) {
      await prisma.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.EXPIRED },
      });

      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Offer has expired and can no longer be accepted",
      );
    }
  }

  if (offer.shipment.userId !== user.id && user.role !== "admin") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only the shipment owner can accept offers",
    );
  }

  const shipment = offer.shipment;
  const trip = offer.trip;
  const weight = shipment.weight;

  // Use transaction to ensure thread-safe capacity deduction and active offer lock
  const result = await prisma.$transaction(async (tx) => {
    // Check if another offer on this shipment is already PAYMENT_PENDING or ACCEPTED
    const existingActiveOffer = await tx.offer.findFirst({
      where: {
        shipmentId: shipment.id,
        id: { not: offer.id },
        status: { in: [OfferStatus.PAYMENT_PENDING, OfferStatus.ACCEPTED] },
      },
    });

    if (existingActiveOffer) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "A checkout or accepted offer already exists for this shipment. Please complete or cancel the active checkout first.",
      );
    }

    // 1. Double check capacity inside transaction (if we are transitioning from PENDING or PAYMENT_CANCELED to PAYMENT_PENDING)
    if (
      offer.status === OfferStatus.PENDING ||
      offer.status === OfferStatus.PAYMENT_CANCELED
    ) {
      const latestTrip = await tx.trip.findUnique({
        where: { id: trip.id },
      });

      if (!latestTrip) {
        throw new ApiError(httpStatus.NOT_FOUND, "Trip not found");
      }

      if (latestTrip.status !== "ACTIVE") {
        throw new ApiError(httpStatus.BAD_REQUEST, "Trip is no longer active");
      }

      if (offer.bagType === "cabin") {
        if (latestTrip.remainingCabinCapacity < weight) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Insufficient cabin bag capacity on trip. Needed: ${weight}kg, Available: ${latestTrip.remainingCabinCapacity}kg`,
          );
        }

        await tx.trip.update({
          where: { id: trip.id },
          data: {
            remainingCabinCapacity: { decrement: weight },
          },
        });
      } else {
        if (latestTrip.remainingCheckInCapacity < weight) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Insufficient check-in bag capacity on trip. Needed: ${weight}kg, Available: ${latestTrip.remainingCheckInCapacity}kg`,
          );
        }

        await tx.trip.update({
          where: { id: trip.id },
          data: {
            remainingCheckInCapacity: { decrement: weight },
          },
        });
      }
    }

    // 2. Set offer status to PAYMENT_PENDING (enforced by DB partial unique index)
    const pendingOffer = await tx.offer.update({
      where: { id: offerId },
      data: { status: OfferStatus.PAYMENT_PENDING },
    });

    // Clean up existing payment transactions if they are pending or failed to avoid unique constraint crash
    const existingTx = await tx.paymentTransaction.findUnique({
      where: { shipmentId: shipment.id },
    });

    if (existingTx) {
      if (
        existingTx.status === "PENDING_PAYMENT" ||
        existingTx.status === "FAILED"
      ) {
        await tx.paymentTransaction.delete({
          where: { id: existingTx.id },
        });
      } else {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `An active or completed payment transaction already exists for this shipment (status: ${existingTx.status}).`,
        );
      }
    }

    // 3. Fetch system commission rate setting (strictly require configuration)
    const commissionSetting = await tx.systemSetting.findUnique({
      where: { key: "WITHDRAWAL_COMMISSION_RATE" },
    });

    if (!commissionSetting) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Platform commission rate setting is not configured",
      );
    }

    const commissionRate = parseFloat(commissionSetting.value);
    if (isNaN(commissionRate)) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Invalid platform commission rate configuration",
      );
    }

    const transactionId = `SHP-${Math.floor(100000 + Math.random() * 900000)}`;
    const grossAmount = shipment.weight * offer.offeredPrice;
    const commissionAmount = grossAmount * commissionRate;
    const netAmount = grossAmount - commissionAmount;

    const paymentTx = await tx.paymentTransaction.create({
      data: {
        transactionId,
        shipmentId: shipment.id,
        offerId: offer.id,
        senderId: shipment.userId,
        travellerId: offer.travellerId,
        grossAmount,
        commissionRate,
        commissionAmount,
        netAmount,
        currency: "USD",
        paymentGateway: "STRIPE",
        status: "PENDING_PAYMENT",
      },
    });

    // 4. Create Stripe / Gateway checkout session
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const paymentAdapter = getPaymentAdapter();

    const checkoutResult = await paymentAdapter.createCheckoutSession({
      transactionId: paymentTx.transactionId,
      shipmentId: shipment.id,
      itemName: shipment.itemName,
      amount: grossAmount,
      currency: "USD",
      senderEmail: (shipment as any).user?.email,
      successUrl: `${frontendUrl}/dashboard/payment-earnings?tab=payments&success=true&tx=${paymentTx.transactionId}`,
      cancelUrl: `${frontendUrl}/dashboard/my-shipments?cancelled=true`,
    });

    return {
      offer: pendingOffer,
      transactionId: paymentTx.transactionId,
      checkoutUrl: checkoutResult.checkoutUrl,
    };
  });

  return result;
};

const cancelCheckout = async (offerId: string, user: User) => {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { shipment: true, trip: true },
  });

  if (!offer) {
    throw new ApiError(httpStatus.NOT_FOUND, "Offer not found");
  }

  if (offer.shipment.userId !== user.id && user.role !== "admin") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only the shipment owner can cancel checkout",
    );
  }

  if (offer.status !== OfferStatus.PAYMENT_PENDING) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Only payment pending offers can be canceled",
    );
  }

  return prisma.$transaction(async (tx) => {
    // 1. Restore trip capacity
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

    // 2. Set offer status to PAYMENT_CANCELED
    const revertedOffer = await tx.offer.update({
      where: { id: offerId },
      data: { status: OfferStatus.PAYMENT_CANCELED },
    });

    // 3. Mark payment transaction as FAILED
    await tx.paymentTransaction.updateMany({
      where: { offerId: offer.id, status: "PENDING_PAYMENT" },
      data: { status: "FAILED" },
    });

    return revertedOffer;
  });
};

const rejectOffer = async (offerId: string, user: User) => {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { shipment: true },
  });

  if (!offer) {
    throw new ApiError(httpStatus.NOT_FOUND, "Offer not found");
  }

  if (
    offer.status !== OfferStatus.PENDING &&
    offer.status !== OfferStatus.PAYMENT_CANCELED
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Only pending or payment canceled offers can be rejected",
    );
  }

  if (
    offer.status === OfferStatus.PENDING ||
    offer.status === OfferStatus.PAYMENT_CANCELED
  ) {
    const isExpired =
      Date.now() - new Date(offer.createdAt).getTime() >
      OFFER_EXPIRATION_MINUTES * 60 * 1000;

    if (isExpired) {
      await prisma.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.EXPIRED },
      });

      throw new ApiError(httpStatus.BAD_REQUEST, "Offer has expired");
    }
  }

  if (offer.shipment.userId !== user.id && user.role !== "admin") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only the shipment owner can reject offers",
    );
  }

  const rejectedOffer = await prisma.offer.update({
    where: { id: offerId },
    data: { status: OfferStatus.REJECTED },
  });

  // Create notification for traveller that their offer was rejected
  await prisma.notification.create({
    data: {
      userId: offer.travellerId,
      title: "Offer Rejected",
      message: `Your offer for shipment "${offer.shipment.itemName}" was declined by the sender.`,
    },
  });

  return rejectedOffer;
};

export const OfferService = {
  createOffer,
  getOffersForShipment,
  getReceivedOffers,
  getSentOffers,
  acceptOffer,
  cancelCheckout,
  rejectOffer,
};

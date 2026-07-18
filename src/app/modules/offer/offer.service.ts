import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { User } from "../../lib/auth";
import { OfferStatus, ShipmentStatus } from "../../../generated/prisma/enums";
import { z } from "zod";
import { OfferValidation } from "./offer.validation";
import { ShipmentStepService } from "../shipment/shipment-step.service";

const createOffer = async (
  payload: z.infer<typeof OfferValidation.createOfferSchema>,
  user: User,
) => {
  const { shipmentId, tripId, offeredPrice, bagType } = payload;

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

  // Check no existing PENDING or ACCEPTED offer from this traveller for this shipment
  const existingOffer = await prisma.offer.findFirst({
    where: {
      shipmentId,
      travellerId: user.id,
      status: { in: [OfferStatus.PENDING, OfferStatus.ACCEPTED] },
    },
  });

  if (existingOffer) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "You already have an active offer for this shipment",
    );
  }

  const isCounterOffer = offeredPrice !== shipment.pricePerKg;

  // Create or upsert Offer
  const offer = await prisma.offer.create({
    data: {
      shipmentId,
      travellerId: user.id,
      tripId,
      senderPrice: shipment.pricePerKg,
      offeredPrice,
      bagType,
      isCounterOffer,
      status: OfferStatus.PENDING,
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
  const offers = await prisma.offer.findMany({
    where: {
      shipment: {
        userId: user.id,
      },
      status: OfferStatus.PENDING,
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

  if (offer.status !== OfferStatus.PENDING) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Only pending offers can be accepted",
    );
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

  // Use transaction to ensure thread-safe capacity deduction and updates
  const result = await prisma.$transaction(async (tx) => {
    // 1. Double check capacity inside transaction
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

    // 2. Accept this offer
    const acceptedOffer = await tx.offer.update({
      where: { id: offerId },
      data: { status: OfferStatus.ACCEPTED },
    });

    // 3. Reject all other pending offers for this shipment
    await tx.offer.updateMany({
      where: {
        shipmentId: shipment.id,
        id: { not: offerId },
        status: OfferStatus.PENDING,
      },
      data: { status: OfferStatus.REJECTED },
    });

    // 4. Update shipment links
    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        tripId: trip.id,
        bagType: offer.bagType,
        pricePerKg: offer.offeredPrice,
      },
    });

    // 5. Create notification for traveller
    await tx.notification.create({
      data: {
        userId: offer.travellerId,
        title: "Offer Accepted",
        message: `Your offer of $${offer.offeredPrice} for shipment "${shipment.itemName}" has been accepted!`,
      },
    });

    // 6. Call the confirm payment service in shipment inside the same transaction
    await ShipmentStepService.confirmPayment(shipment.id, user, tx);

    return acceptedOffer;
  });

  return result;
};

const rejectOffer = async (offerId: string, user: User) => {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { shipment: true },
  });

  if (!offer) {
    throw new ApiError(httpStatus.NOT_FOUND, "Offer not found");
  }

  if (offer.status !== OfferStatus.PENDING) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Only pending offers can be rejected",
    );
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
  rejectOffer,
};

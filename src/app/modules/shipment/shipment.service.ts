import { ShipmentValidation } from "./shipment.validation";
import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { paginationHelpers } from "../../helper/paginationHelpers";
import { fileUploader } from "../../helper/fileUploader";
import z from "zod";
import { User } from "../../lib/auth";
import { ShipmentOtpService } from "./shipment-otp.service";
import { notifyAvailableShipmentsCountUpdated } from "../../lib/socket";
import { ShipmentStatus, OfferStatus } from "../../../generated/prisma/enums";
import { PaymentService } from "../payment/payment.service";

const cleanupOrphanPhotos = async (oldUrls: string[], newUrls: string[]) => {
  const removedUrls = oldUrls.filter((url) => !newUrls.includes(url));
  if (removedUrls.length > 0) {
    await Promise.allSettled(
      removedUrls.map((url) =>
        fileUploader.deletePublicFile(fileUploader.extractKey(url)),
      ),
    );
  }
};

const validateConstraints = (
  data: {
    weight: number;
    quantity: number;
    pricePerKg: number;
  },
  category: {
    maxWeight: number | null;
    minPrice: number;
    maxPrice: number | null;
    maxQuantity: number | null;
  },
) => {
  if (category.maxWeight && data.weight > category.maxWeight) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Weight exceeds category maximum of ${category.maxWeight}`,
    );
  }

  if (category.maxQuantity && data.quantity > category.maxQuantity) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Quantity exceeds category maximum of ${category.maxQuantity}`,
    );
  }

  if (data.pricePerKg && data.pricePerKg < category.minPrice) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Price must be at least ${category.minPrice}`,
    );
  }

  if (category.maxPrice && data.pricePerKg > category.maxPrice) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Price must not exceed ${category.maxPrice}`,
    );
  }
};

const createShipment = async (
  data: z.infer<typeof ShipmentValidation.createShipmentSchema>,
  user: User,
) => {
  const { otp, ...shipmentData } = data;

  if (
    shipmentData.fromCountry.toLowerCase() ===
    shipmentData.toCountry.toLowerCase()
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Origin country and destination country cannot be the same",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await ShipmentOtpService.verifyShipmentOtp(user.email, otp, tx);

    const category = await tx.shipmentCategory.findUnique({
      where: { id: shipmentData.categoryId },
    });

    if (!category) {
      throw new ApiError(404, "Shipment category not found");
    }

    validateConstraints(shipmentData, category);

    const shipment = await tx.shipment.create({
      data: {
        ...shipmentData,
        itemPhotos: shipmentData.itemPhotos ?? [],
        userId: user.id,
      },
    });

    const definitions = await tx.stepDefinition.findMany({
      orderBy: { order: "asc" },
    });

    await tx.shipmentStep.createMany({
      data: definitions.map((def) => ({
        shipmentId: shipment.id,
        definitionId: def.id,
        stage: def.stage,
        order: def.order,
        isCurrent: def.order === 1,
        completedAt: null,
      })),
    });

    const createdShipment = await tx.shipment.findUnique({
      where: { id: shipment.id },
      include: { category: true },
    });

    notifyAvailableShipmentsCountUpdated();

    return createdShipment;
  });

  return result;
};

const getShipments = async (query: Record<string, unknown>, user: User) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(query);

  const where: any = {};

  // Available shipments filter (browse page)
  if (query.type === "available") {
    where.tripId = null;
    if (query.fromCountry) {
      where.fromCountry = {
        contains: query.fromCountry as string,
        mode: "insensitive",
      };
    }
    if (query.toCountry) {
      where.toCountry = {
        contains: query.toCountry as string,
        mode: "insensitive",
      };
    }
  }

  // Role-based user filter
  if (user.role !== "admin") {
    where.userId = user.id;
  } else if (query.userId) {
    where.userId = query.userId as string;
  }

  // Status filter
  if (query.status) {
    if (query.status === "PENDING_RELEASE") {
      where.paymentTransaction = { status: "PENDING_RELEASE" };
    } else {
      where.status = query.status as string;
    }
  }

  // Search across multiple fields
  if (query.search) {
    const searchTerm = query.search as string;
    const cleanSearchTerm = searchTerm.toUpperCase().replace(/^SH-?/, "");
    where.OR = [
      { id: { contains: cleanSearchTerm, mode: "insensitive" } },
      { itemName: { contains: searchTerm, mode: "insensitive" } },
      { description: { contains: searchTerm, mode: "insensitive" } },
      { receiverName: { contains: searchTerm, mode: "insensitive" } },
      { fromCountry: { contains: searchTerm, mode: "insensitive" } },
      { toCountry: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  // Dynamic sort with whitelist
  const allowedSortFields = [
    "itemName",
    "pricePerKg",
    "fromCountry",
    "toCountry",
    "createdAt",
    "status",
    "weight",
  ];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "itemName";

  const result = await prisma.shipment.findMany({
    where,
    skip,
    take: limit,
    orderBy: { [sortField]: sortOrder },
    include: {
      category: true,
      paymentTransaction: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  const total = await prisma.shipment.count({ where });

  return { data: result, meta: { page, limit, total } };
};

const getShipmentById = async (id: string, user: User) => {
  const result = await prisma.shipment.findFirst({
    where: { id, userId: user.role !== "admin" ? user.id : undefined },
    include: { category: true },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  return result;
};

const getShipmentSteps = async (shipmentId: string, user: User) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: { id: true, userId: true, trip: { select: { userId: true } } },
  });

  if (!shipment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  if (
    user.role !== "admin" &&
    shipment.userId !== user.id &&
    shipment.trip?.userId !== user.id
  ) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
  }

  const steps = await prisma.shipmentStep.findMany({
    where: { shipmentId },
    include: { definition: true },
    orderBy: { order: "asc" },
  });

  return steps;
};

const updateShipment = async (
  id: string,
  data: z.infer<typeof ShipmentValidation.updateShipmentSchema>,
  user: User,
) => {
  const existing = await prisma.shipment.findUnique({
    where: { id, userId: user.role !== "admin" ? user.id : undefined },
  });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  const finalFromCountry =
    data.fromCountry !== undefined ? data.fromCountry : existing.fromCountry;
  const finalToCountry =
    data.toCountry !== undefined ? data.toCountry : existing.toCountry;

  if (
    finalFromCountry &&
    finalToCountry &&
    finalFromCountry.toLowerCase() === finalToCountry.toLowerCase()
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Origin country and destination country cannot be the same",
    );
  }

  if (data.categoryId || data.weight || data.quantity || data.pricePerKg) {
    const category = await prisma.shipmentCategory.findUnique({
      where: { id: data.categoryId ?? existing.categoryId },
    });

    if (!category) {
      throw new ApiError(httpStatus.NOT_FOUND, "Shipment category not found");
    }

    validateConstraints(
      {
        weight: data.weight ?? existing.weight,
        quantity: data.quantity ?? existing.quantity,
        pricePerKg: data.pricePerKg ?? existing.pricePerKg,
      },
      category,
    );
  }

  const oldPhotos = data.itemPhotos !== undefined ? existing.itemPhotos : null;

  const result = await prisma.shipment.update({
    where: { id, userId: user.role !== "admin" ? user.id : undefined },
    data,
    include: { category: true },
  });

  if (oldPhotos !== null) {
    await cleanupOrphanPhotos(oldPhotos, data.itemPhotos!);
  }

  return result;
};

const deleteShipment = async (id: string, user: User) => {
  const existing = await prisma.shipment.findFirst({
    where: { id, userId: user.role !== "admin" ? user.id : undefined },
  });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  const result = await prisma.shipment.delete({ where: { id } });

  if (existing.itemPhotos.length > 0) {
    await Promise.allSettled(
      existing.itemPhotos.map((url) =>
        fileUploader.deletePublicFile(fileUploader.extractKey(url)),
      ),
    );
  }

  return result;
};

const getShipmentDetails = async (id: string, user: User) => {
  const result = await prisma.shipment.findFirst({
    where: {
      id,
      OR:
        user.role === "admin"
          ? undefined
          : [{ userId: user.id }, { trip: { userId: user.id } }],
    },
    include: {
      category: true,
      paymentTransaction: true,
      shipmentSteps: {
        include: { definition: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  let tripData = null;

  if (result.tripId) {
    const trip = await prisma.trip.findUnique({
      where: { id: result.tripId },
      include: {
        shipments: { select: { weight: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
          },
        },
      },
    });

    if (trip) {
      tripData = {
        id: trip.id,
        flightNumber: trip.flightNumber,
        fromCountry: trip.fromCountry,
        toCountry: trip.toCountry,
        flightDate: trip.flightDate,
        flightTime: trip.flightTime,
        airportArrivalTime: trip.airportArrivalTime,
        status: trip.status,
        cabinBagCapacity: trip.cabinBagCapacity,
        checkInBagCapacity: trip.checkInBagCapacity,
        remainingCabinCapacity: trip.remainingCabinCapacity,
        remainingCheckInCapacity: trip.remainingCheckInCapacity,
        user: trip.user,
      };
    }
  }

  // Role-based payment data scoping:
  let scopedPaymentTransaction = null;
  if (result.paymentTransaction) {
    if (user.role === "admin") {
      // Admin gets full payment transaction details
      scopedPaymentTransaction = result.paymentTransaction;
    } else if (user.id === result.userId) {
      // Sender gets transaction overview (excluding internal gateway credentials)
      const { gatewayTxnId, ...senderPayment } = result.paymentTransaction;
      scopedPaymentTransaction = senderPayment;
    } else if (tripData?.user?.id === user.id) {
      // Assigned traveler gets earnings/release status only
      scopedPaymentTransaction = {
        status: result.paymentTransaction.status,
        grossAmount: result.paymentTransaction.grossAmount,
        releasedAt: result.paymentTransaction.releasedAt,
      };
    }
  }

  return {
    ...result,
    trip: tripData,
    paymentTransaction: scopedPaymentTransaction,
  };
};

const cancelShipment = async (id: string, user: User) => {
  const shipment = await prisma.shipment.findFirst({
    where: {
      id,
      OR:
        user.role === "admin"
          ? undefined
          : [{ userId: user.id }, { trip: { userId: user.id } }],
    },
    include: {
      shipmentSteps: true,
      paymentTransaction: true,
    },
  });

  if (!shipment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  if (shipment.status === ShipmentStatus.CANCELED) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Shipment is already canceled");
  }

  // Check if PICKED_UP step has been completed
  const pickedUpStep = shipment.shipmentSteps.find(
    (step) => step.stage === "PICKED_UP" && step.completedAt !== null,
  );

  if (pickedUpStep) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot cancel shipment directly after item has been picked up. Please open a support ticket.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const updatedShipment = await tx.shipment.update({
      where: { id },
      data: { status: ShipmentStatus.CANCELED },
    });

    await PaymentService.markPaymentAsPendingRefund(
      id,
      `Shipment canceled by ${user.role === "admin" ? "admin" : "user"} before pickup`,
      tx,
    );

    await tx.offer.updateMany({
      where: {
        shipmentId: id,
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

    return updatedShipment;
  });
};

export const ShipmentService = {
  createShipment,
  getShipments,
  getShipmentById,
  getShipmentDetails,
  getShipmentSteps,
  updateShipment,
  deleteShipment,
  cancelShipment,
};

import { ShipmentValidation } from "./shipment.validation";
import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { paginationHelpers } from "../../helper/paginationHelpers";
import { fileUploader } from "../../helper/fileUploader";
import z from "zod";
import { User } from "../../lib/auth";
import { ShipmentOtpService } from "./shipment-otp.service";

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

  const result = await prisma.$transaction(async (tx) => {
    await ShipmentOtpService.verifyShipmentOtp(user.email, otp, tx);

    const category = await tx.shipmentCategory.findUnique({
      where: { id: shipmentData.categoryId },
    });

    if (!category) {
      throw new ApiError(404, "Shipment category not found");
    }

    validateConstraints(shipmentData, category);

    return tx.shipment.create({
      data: {
        ...shipmentData,
        itemPhotos: shipmentData.itemPhotos ?? [],
        userId: user.id,
      },
      include: { category: true },
    });
  });

  return result;
};

const getShipments = async (query: Record<string, unknown>, user: User) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(query);

  const where = { userId: user.role !== "admin" ? user.id : undefined };

  const result = await prisma.shipment.findMany({
    where,
    skip,
    take: limit,
    orderBy: { itemName: "asc" },
    include: { category: true },
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

export const ShipmentService = {
  createShipment,
  getShipments,
  getShipmentById,
  updateShipment,
  deleteShipment,
};

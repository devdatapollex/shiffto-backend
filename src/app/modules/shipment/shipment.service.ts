import prisma from "../../lib/prisma";
import ApiError from "../../errors/ApiError";
import { paginationHelpers } from "../../helper/paginationHelpers";

const validateConstraints = (
  data: {
    weight?: number;
    quantity?: number;
    pricePerKg?: number;
  },
  category: {
    maxWeight?: number | null;
    minPrice: number;
    maxPrice?: number | null;
    maxQuantity?: number | null;
  },
) => {
  if (
    data.weight !== undefined &&
    category.maxWeight !== undefined &&
    category.maxWeight !== null &&
    data.weight > category.maxWeight
  ) {
    throw new ApiError(
      400,
      `Weight exceeds category maximum of ${category.maxWeight}`,
    );
  }

  if (
    data.quantity !== undefined &&
    category.maxQuantity !== undefined &&
    category.maxQuantity !== null &&
    data.quantity > category.maxQuantity
  ) {
    throw new ApiError(
      400,
      `Quantity exceeds category maximum of ${category.maxQuantity}`,
    );
  }

  if (data.pricePerKg !== undefined && data.pricePerKg < category.minPrice) {
    throw new ApiError(400, `Price must be at least ${category.minPrice}`);
  }

  if (
    data.pricePerKg !== undefined &&
    category.maxPrice !== undefined &&
    category.maxPrice !== null &&
    data.pricePerKg > category.maxPrice
  ) {
    throw new ApiError(400, `Price must not exceed ${category.maxPrice}`);
  }
};

const createShipment = async (
  data: {
    itemName: string;
    weight: number;
    quantity: number;
    description: string;
    itemPhotos?: string[];
    instructions: string;
    fromCountry: string;
    toCountry: string;
    pricePerKg: number;
    receiverName: string;
    receiverPhone: string;
    receiverAddress: string;
    categoryId: string;
  },
  userId: string,
) => {
  const category = await prisma.shipmentCategory.findUnique({
    where: { id: data.categoryId },
  });

  if (!category) {
    throw new ApiError(404, "Shipment category not found");
  }

  validateConstraints(data, category);

  const result = await prisma.shipment.create({
    data: {
      ...data,
      itemPhotos: data.itemPhotos ?? [],
      userId,
    },
    include: { category: true },
  });

  return result;
};

const getShipments = async (query: Record<string, unknown>, userId: string) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(query);

  const where = { userId };

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

const getShipmentById = async (id: string, userId: string) => {
  const result = await prisma.shipment.findFirst({
    where: { id, userId },
    include: { category: true },
  });

  if (!result) {
    throw new ApiError(404, "Shipment not found");
  }

  return result;
};

const updateShipment = async (
  id: string,
  data: {
    itemName?: string;
    weight?: number;
    quantity?: number;
    description?: string;
    itemPhotos?: string[];
    instructions?: string;
    fromCountry?: string;
    toCountry?: string;
    pricePerKg?: number;
    receiverName?: string;
    receiverPhone?: string;
    receiverAddress?: string;
    categoryId?: string;
  },
  userId: string,
) => {
  const existing = await prisma.shipment.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new ApiError(404, "Shipment not found");
  }

  if (
    data.categoryId ||
    data.weight !== undefined ||
    data.quantity !== undefined ||
    data.pricePerKg !== undefined
  ) {
    const category = await prisma.shipmentCategory.findUnique({
      where: { id: data.categoryId ?? existing.categoryId },
    });

    if (!category) {
      throw new ApiError(404, "Shipment category not found");
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

  const result = await prisma.shipment.update({
    where: { id },
    data,
    include: { category: true },
  });

  return result;
};

const deleteShipment = async (id: string, userId: string) => {
  const existing = await prisma.shipment.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new ApiError(404, "Shipment not found");
  }

  const result = await prisma.shipment.delete({ where: { id } });

  return result;
};

export const ShipmentService = {
  createShipment,
  getShipments,
  getShipmentById,
  updateShipment,
  deleteShipment,
};

import prisma from "../../lib/prisma";
import ApiError from "../../errors/ApiError";
import { paginationHelpers } from "../../helper/paginationHelpers";

const createCategory = async (data: {
  name: string;
  slug: string;
  maxWeight?: number;
  minPrice: number;
  maxPrice?: number;
  maxQuantity?: number;
}) => {
  const result = await prisma.shipmentCategory.create({ data });
  return result;
};

const getCategories = async (query: Record<string, unknown>) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(query);

  const result = await prisma.shipmentCategory.findMany({
    skip,
    take: limit,
    orderBy: { name: "asc" },
  });

  const total = await prisma.shipmentCategory.count();

  return { data: result, meta: { page, limit, total } };
};

const getCategoryById = async (id: string) => {
  const result = await prisma.shipmentCategory.findUnique({ where: { id } });

  if (!result) {
    throw new ApiError(404, "Shipment category not found");
  }

  return result;
};

const updateCategory = async (
  id: string,
  data: {
    name?: string;
    slug?: string;
    maxWeight?: number;
    minPrice?: number;
    maxPrice?: number;
    maxQuantity?: number;
  },
) => {
  await getCategoryById(id);

  const result = await prisma.shipmentCategory.update({
    where: { id },
    data,
  });

  return result;
};

const deleteCategory = async (id: string) => {
  await getCategoryById(id);

  const result = await prisma.shipmentCategory.delete({ where: { id } });

  return result;
};

export const ShipmentCategoryService = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};

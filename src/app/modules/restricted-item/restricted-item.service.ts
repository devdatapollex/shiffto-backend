import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { paginationHelpers } from "../../helper/paginationHelpers";
import { RestrictedItemValidation } from "./restricted-item.validation";
import z from "zod";

const createItem = async (
  data: z.infer<typeof RestrictedItemValidation.createRestrictedItemSchema>,
) => {
  const result = await prisma.restrictedItem.create({ data });
  return result;
};

const getItems = async (query: Record<string, unknown>) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(query);
  const search =
    typeof query.search === "string" ? query.search.trim() : undefined;
  const activeOnly = query.activeOnly === "true";

  const where: any = {};
  if (activeOnly) {
    where.isActive = true;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const result = await prisma.restrictedItem.findMany({
    where,
    skip,
    take: limit,
    orderBy: { name: "asc" },
  });

  const total = await prisma.restrictedItem.count({ where });

  return { data: result, meta: { page, limit, total } };
};

const getItemById = async (id: string) => {
  const result = await prisma.restrictedItem.findUnique({ where: { id } });
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Restricted item not found");
  }
  return result;
};

const updateItem = async (
  id: string,
  data: z.infer<typeof RestrictedItemValidation.updateRestrictedItemSchema>,
) => {
  await getItemById(id);
  const result = await prisma.restrictedItem.update({
    where: { id },
    data,
  });
  return result;
};

const deleteItem = async (id: string) => {
  await getItemById(id);
  const result = await prisma.restrictedItem.delete({ where: { id } });
  return result;
};

export const RestrictedItemService = {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem,
};

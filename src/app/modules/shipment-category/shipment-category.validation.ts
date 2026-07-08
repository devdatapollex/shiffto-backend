import { z } from "zod";

const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    maxWeight: z.number().positive().optional(),
    minPrice: z.number().positive(),
    maxPrice: z.number().positive().optional(),
    maxQuantity: z.number().int().positive().optional(),
  }),
});

const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    maxWeight: z.number().positive().optional(),
    minPrice: z.number().positive().optional(),
    maxPrice: z.number().positive().optional(),
    maxQuantity: z.number().int().positive().optional(),
  }),
});

export const ShipmentCategoryValidation = {
  createCategorySchema,
  updateCategorySchema,
};

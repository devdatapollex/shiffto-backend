import { z } from "zod";

const createCategorySchema = z.object({
  name: z
    .string({ error: "Category name is required" })
    .min(1, { error: "Category name must not be empty" }),
  slug: z
    .string({ error: "Category slug is required" })
    .min(1, { error: "Category slug must not be empty" }),
  maxWeight: z
    .number({ error: "Max weight must be a number" })
    .positive({ error: "Max weight must be a positive number" })
    .optional()
    .nullable(),
  minPrice: z
    .number({
      error: (iss) =>
        iss.input === undefined
          ? "Minimum price is required"
          : "Minimum price must be a number",
    })
    .positive({ error: "Minimum price must be a positive number" }),
  maxPrice: z
    .number({ error: "Max price must be a number" })
    .positive({ error: "Max price must be a positive number" })
    .optional()
    .nullable(),
  maxQuantity: z
    .number({ error: "Max quantity must be a number" })
    .int({ error: "Max quantity must be a whole number" })
    .positive({ error: "Max quantity must be at least 1" })
    .optional()
    .nullable(),
});

const updateCategorySchema = z.object({
  name: z
    .string({ error: "Category name must be a string" })
    .min(1, { error: "Category name must not be empty" })
    .optional(),
  slug: z
    .string({ error: "Category slug must be a string" })
    .min(1, { error: "Category slug must not be empty" })
    .optional(),
  maxWeight: z
    .number({ error: "Max weight must be a number" })
    .positive({ error: "Max weight must be a positive number" })
    .optional()
    .nullable(),
  minPrice: z
    .number({ error: "Minimum price must be a number" })
    .positive({ error: "Minimum price must be a positive number" })
    .optional(),
  maxPrice: z
    .number({ error: "Max price must be a number" })
    .positive({ error: "Max price must be a positive number" })
    .optional()
    .nullable(),
  maxQuantity: z
    .number({ error: "Max quantity must be a number" })
    .int({ error: "Max quantity must be a whole number" })
    .positive({ error: "Max quantity must be at least 1" })
    .optional()
    .nullable(),
});

export const ShipmentCategoryValidation = {
  createCategorySchema,
  updateCategorySchema,
};

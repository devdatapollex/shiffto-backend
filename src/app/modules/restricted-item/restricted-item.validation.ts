import { z } from "zod";

const createRestrictedItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

const updateRestrictedItemSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const RestrictedItemValidation = {
  createRestrictedItemSchema,
  updateRestrictedItemSchema,
};

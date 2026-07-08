import { z } from "zod";

const createShipmentSchema = z.object({
  body: z.object({
    itemName: z.string().min(1),
    weight: z.number().positive(),
    quantity: z.number().int().positive(),
    description: z.string().min(1),
    itemPhotos: z.array(z.string()).optional().default([]),
    instructions: z.string().min(1),
    fromCountry: z.string().min(1),
    toCountry: z.string().min(1),
    pricePerKg: z.number().positive(),
    receiverName: z.string().min(1),
    receiverPhone: z.string().min(1),
    receiverAddress: z.string().min(1),
    categoryId: z.string().min(1),
  }),
});

const updateShipmentSchema = z.object({
  body: z.object({
    itemName: z.string().min(1).optional(),
    weight: z.number().positive().optional(),
    quantity: z.number().int().positive().optional(),
    description: z.string().min(1).optional(),
    itemPhotos: z.array(z.string()).optional(),
    instructions: z.string().min(1).optional(),
    fromCountry: z.string().min(1).optional(),
    toCountry: z.string().min(1).optional(),
    pricePerKg: z.number().positive().optional(),
    receiverName: z.string().min(1).optional(),
    receiverPhone: z.string().min(1).optional(),
    receiverAddress: z.string().min(1).optional(),
    categoryId: z.string().min(1).optional(),
  }),
});

export const ShipmentValidation = {
  createShipmentSchema,
  updateShipmentSchema,
};

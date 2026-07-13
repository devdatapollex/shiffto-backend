import { z } from "zod";

const createShipmentSchema = z.object({
  itemName: z
    .string({ error: "Item name is required" })
    .min(1, { error: "Item name must not be empty" }),
  weight: z
    .number({
      error: (iss) =>
        iss.input === undefined
          ? "Weight is required"
          : "Weight must be a number",
    })
    .positive({ error: "Weight must be a positive number" }),
  quantity: z
    .number({
      error: (iss) =>
        iss.input === undefined
          ? "Quantity is required"
          : "Quantity must be a number",
    })
    .int({ error: "Quantity must be a whole number" })
    .positive({ error: "Quantity must be at least 1" }),
  description: z
    .string({ error: "Description is required" })
    .min(1, { error: "Description must not be empty" }),
  itemPhotos: z
    .array(
      z
        .string({ error: "Each photo URL must be a string" })
        .min(1, { error: "Photo URL must not be empty" }),
      { error: "Item photos must be an array" },
    )
    .min(0, { error: "At least 1 item photo is required" })
    .max(10, { error: "Maximum 10 item photos allowed" }),
  instructions: z
    .string({ error: "Instructions are required" })
    .min(1, { error: "Instructions must not be empty" }),
  fromCountry: z
    .string({ error: "Origin country is required" })
    .min(1, { error: "Origin country must not be empty" }),
  toCountry: z
    .string({ error: "Destination country is required" })
    .min(1, { error: "Destination country must not be empty" }),
  pricePerKg: z
    .number({
      error: (iss) =>
        iss.input === undefined
          ? "Price per kg is required"
          : "Price per kg must be a number",
    })
    .positive({ error: "Price per kg must be a positive number" }),
  receiverName: z
    .string({ error: "Receiver name is required" })
    .min(1, { error: "Receiver name must not be empty" }),
  receiverPhone: z
    .string({ error: "Receiver phone number is required" })
    .min(1, { error: "Receiver phone number must not be empty" }),
  receiverAddress: z
    .string({ error: "Receiver address is required" })
    .min(1, { error: "Receiver address must not be empty" }),
  categoryId: z
    .string({ error: "Category is required" })
    .min(1, { error: "Category must not be empty" }),
});

const updateShipmentSchema = z.object({
  itemName: z
    .string({ error: "Item name must be a string" })
    .min(1, { error: "Item name must not be empty" })
    .optional(),
  weight: z
    .number({ error: "Weight must be a number" })
    .positive({ error: "Weight must be a positive number" })
    .optional(),
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int({ error: "Quantity must be a whole number" })
    .positive({ error: "Quantity must be at least 1" })
    .optional(),
  description: z
    .string({ error: "Description must be a string" })
    .min(1, { error: "Description must not be empty" })
    .optional(),
  itemPhotos: z
    .array(
      z
        .string({ error: "Each photo URL must be a string" })
        .min(1, { error: "Photo URL must not be empty" }),
      { error: "Item photos must be an array" },
    )
    .min(0)
    .max(10, { error: "Maximum 10 item photos allowed" })
    .optional(),
  instructions: z
    .string({ error: "Instructions must be a string" })
    .min(1, { error: "Instructions must not be empty" })
    .optional(),
  fromCountry: z
    .string({ error: "Origin country must be a string" })
    .min(1, { error: "Origin country must not be empty" })
    .optional(),
  toCountry: z
    .string({ error: "Destination country must be a string" })
    .min(1, { error: "Destination country must not be empty" })
    .optional(),
  pricePerKg: z
    .number({ error: "Price per kg must be a number" })
    .positive({ error: "Price per kg must be a positive number" })
    .optional(),
  receiverName: z
    .string({ error: "Receiver name must be a string" })
    .min(1, { error: "Receiver name must not be empty" })
    .optional(),
  receiverPhone: z
    .string({ error: "Receiver phone number must be a string" })
    .min(1, { error: "Receiver phone number must not be empty" })
    .optional(),
  receiverAddress: z
    .string({ error: "Receiver address must be a string" })
    .min(1, { error: "Receiver address must not be empty" })
    .optional(),
  categoryId: z
    .string({ error: "Category must be a string" })
    .min(1, { error: "Category must not be empty" })
    .optional(),
});

export const ShipmentValidation = {
  createShipmentSchema,
  updateShipmentSchema,
};

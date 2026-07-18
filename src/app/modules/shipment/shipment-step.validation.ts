import { z } from "zod";

const confirmPickupSchema = z.object({
  photoUrl: z
    .string({ error: "Photo proof is required" })
    .min(1, { error: "Photo URL must not be empty" }),
  notes: z.string().optional(),
});

const confirmCheckinSchema = z.object({
  notes: z.string().optional(),
});

const confirmTransitSchema = z.object({
  notes: z.string().optional(),
});

const confirmArrivalSchema = z.object({
  notes: z.string().optional(),
});

const confirmOutForDeliverySchema = z.object({
  notes: z.string().optional(),
});

const confirmDeliverySchema = z.object({
  otp: z
    .string({ error: "OTP is required" })
    .length(6, { error: "OTP must be 6 digits" }),
  photoUrl: z
    .string({ error: "Photo proof is required" })
    .min(1, { error: "Photo URL must not be empty" }),
  notes: z.string().optional(),
});

export const ShipmentStepValidation = {
  confirmPickupSchema,
  confirmCheckinSchema,
  confirmTransitSchema,
  confirmArrivalSchema,
  confirmOutForDeliverySchema,
  confirmDeliverySchema,
};

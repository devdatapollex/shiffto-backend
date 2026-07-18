import { z } from "zod";

const confirmPickupSchema = z.object({
  photoUrl: z
    .string({ error: "Photo proof must be a string" })
    .optional()
    // REVERT_MARKER: Remove this dev workaround when photo proof is required for pickup.
    .transform(
      (val) =>
        val || "https://placehold.co/600x400?text=Pickup+Proof+Placeholder",
    ),
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
  photoUrl: z
    .string({ error: "Photo proof must be a string" })
    .optional()
    // REVERT_MARKER: Remove this dev workaround when photo proof is required for delivery.
    .transform(
      (val) =>
        val || "https://placehold.co/600x400?text=Delivery+Proof+Placeholder",
    ),
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

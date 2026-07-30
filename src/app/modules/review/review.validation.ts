import { z } from "zod";

const createReviewZodSchema = z.object({
  shipmentId: z.string({ message: "Shipment ID is required" }),
  rating: z
    .number({ message: "Rating is required" })
    .int("Rating must be an integer")
    .min(1, "Rating must be between 1 and 5")
    .max(5, "Rating must be between 1 and 5"),
  comment: z.string().optional(),
});

export const ReviewValidation = {
  createReviewZodSchema,
};

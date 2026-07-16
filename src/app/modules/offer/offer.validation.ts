import { z } from "zod";

const createOfferSchema = z.object({
  shipmentId: z.string({ error: "Shipment ID is required" }),
  tripId: z.string({ error: "Trip ID is required" }),
  offeredPrice: z
    .number({
      error: (iss) =>
        iss.input === undefined
          ? "Offered price is required"
          : "Offered price must be a number",
    })
    .positive({ error: "Price must be positive" }),
  bagType: z.enum(["cabin", "checkIn"], {
    error: "Bag type must be cabin or checkIn",
  }),
});

export const OfferValidation = {
  createOfferSchema,
};

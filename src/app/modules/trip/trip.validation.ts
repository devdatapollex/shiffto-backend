import { z } from "zod";

const createTripSchema = z.object({
  flightNumber: z
    .string({ error: "Flight number is required" })
    .min(1, { error: "Flight number must not be empty" }),
  fromCountry: z
    .string({ error: "From country is required" })
    .min(1, { error: "From country must not be empty" }),
  toCountry: z
    .string({ error: "To country is required" })
    .min(1, { error: "To country must not be empty" }),
  flightDate: z
    .string({ error: "Flight date is required" })
    .min(1, { error: "Flight date must not be empty" }),
  flightTime: z
    .string({ error: "Flight time is required" })
    .min(1, { error: "Flight time must not be empty" }),
  airportArrivalTime: z.string().optional(),
  cabinBagCapacity: z
    .number({
      error: (iss) =>
        iss.input === undefined
          ? "Cabin bag capacity is required"
          : "Cabin bag capacity must be a number",
    })
    .nonnegative({ error: "Cabin bag capacity must be 0 or more" }),
  checkInBagCapacity: z
    .number({
      error: (iss) =>
        iss.input === undefined
          ? "Check-in bag capacity is required"
          : "Check-in bag capacity must be a number",
    })
    .nonnegative({ error: "Check-in bag capacity must be 0 or more" }),
  ticketPhoto: z
    .string()
    .optional()
    // REVERT_MARKER: Remove this dev workaround when flight ticket photo is required.
    .transform((val) => val || "https://placehold.co/600x400?text=Ticket+Photo+Placeholder"),
});

const updateTripSchema = z.object({
  flightNumber: z
    .string({ error: "Flight number must be a string" })
    .min(1, { error: "Flight number must not be empty" })
    .optional(),
  fromCountry: z
    .string({ error: "From country must be a string" })
    .min(1, { error: "From country must not be empty" })
    .optional(),
  toCountry: z
    .string({ error: "To country must be a string" })
    .min(1, { error: "To country must not be empty" })
    .optional(),
  flightDate: z
    .string({ error: "Flight date must be a string" })
    .min(1, { error: "Flight date must not be empty" })
    .optional(),
  flightTime: z
    .string({ error: "Flight time must be a string" })
    .min(1, { error: "Flight time must not be empty" })
    .optional(),
  airportArrivalTime: z.string().optional(),
  cabinBagCapacity: z
    .number({ error: "Cabin bag capacity must be a number" })
    .nonnegative({ error: "Cabin bag capacity must be 0 or more" })
    .optional(),
  checkInBagCapacity: z
    .number({ error: "Check-in bag capacity must be a number" })
    .nonnegative({ error: "Check-in bag capacity must be 0 or more" })
    .optional(),
  ticketPhoto: z
    .string({ error: "Flight ticket photo must be a string" })
    .optional()
    // REVERT_MARKER: Remove this dev workaround when flight ticket photo is required.
    .transform((val) => val || "https://placehold.co/600x400?text=Ticket+Photo+Placeholder"),
});

const verifyTripSchema = z.object({
  approved: z.boolean({
    error: "Approved status (true/false) is required",
  }),
  rejectionReason: z.string().optional(),
});

export const TripValidation = {
  createTripSchema,
  updateTripSchema,
  verifyTripSchema,
};

import { z } from "zod";

const reviewKycSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (
        data.status === "REJECTED" &&
        (!data.rejectionReason || data.rejectionReason.trim() === "")
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Rejection reason is required when status is REJECTED",
      path: ["rejectionReason"],
    },
  );

export const AdminValidation = {
  reviewKycSchema,
};

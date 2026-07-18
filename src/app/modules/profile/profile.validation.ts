import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  phone: z.string().optional().nullable(),
  image: z.string().url().optional().nullable().or(z.literal("")),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmPassword: z
      .string()
      .min(8, "Confirm password must be at least 8 characters"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  });

const submitKycSchema = z.object({
  documentType: z.enum(["PASSPORT", "DRIVING_LICENSE", "NID"]),
  documentNumber: z.string().min(1, "Document number is required"),
  nationality: z.string().min(1, "Nationality is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  frontPhotoUrl: z
    .string()
    .optional()
    // REVERT_MARKER: Remove this dev workaround when document photos are required for KYC.
    .transform(
      (val) => val || "https://placehold.co/600x400?text=KYC+Front+Photo",
    ),
  frontPhotoKey: z
    .string()
    .optional()
    // REVERT_MARKER: Remove this dev workaround when document photos are required for KYC.
    .transform((val) => val || "dummy-kyc-front-key"),
  backPhotoUrl: z
    .string()
    .optional()
    // REVERT_MARKER: Remove this dev workaround when document photos are required for KYC.
    .transform(
      (val) => val || "https://placehold.co/600x400?text=KYC+Back+Photo",
    ),
  backPhotoKey: z
    .string()
    .optional()
    // REVERT_MARKER: Remove this dev workaround when document photos are required for KYC.
    .transform((val) => val || "dummy-kyc-back-key"),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export const ProfileValidation = {
  updateProfileSchema,
  changePasswordSchema,
  submitKycSchema,
  deleteAccountSchema,
};

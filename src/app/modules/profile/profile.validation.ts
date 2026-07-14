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
  frontPhotoUrl: z.string().url("Front photo URL is required"),
  frontPhotoKey: z.string().min(1, "Front photo key is required"),
  backPhotoUrl: z.string().url("Back photo URL is required"),
  backPhotoKey: z.string().min(1, "Back photo key is required"),
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

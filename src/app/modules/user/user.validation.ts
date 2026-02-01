import z, { email } from "zod";

const createPatientZodSchema = z.object({
    password: z.string(),
    patient: z.object({
        name: z.string().nonempty('Name is required'),
        email: z.string().nonempty('Email is required').email('Invalid email address'),
        address: z.string().optional(),
    }),
});

const createAdminZodSchema = z.object({
    password: z.string(),
    admin: z.object({
        name: z.string().nonempty('Name is required'),
        email: z.string().nonempty('Email is required').email('Invalid email address'),
        contactNumber: z.string().optional(),
        address: z.string().optional(),
    }),
});

export const UserValidation = {
    createPatientZodSchema,
    createAdminZodSchema,
};
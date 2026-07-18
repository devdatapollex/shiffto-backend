import { z } from "zod";

const updateStepDefinitionSchema = z.object({
  label: z
    .string({ error: "Label must be a string" })
    .min(1, { error: "Label must not be empty" })
    .optional(),
  description: z
    .string({ error: "Description must be a string" })
    .nullable()
    .optional(),
});

export const StepDefinitionValidation = {
  updateStepDefinitionSchema,
};

import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import z from "zod";
import { StepDefinitionValidation } from "./step-definition.validation";

const getStepDefinitions = async () => {
  const result = await prisma.stepDefinition.findMany({
    orderBy: { order: "asc" },
  });

  return result;
};

const updateStepDefinition = async (
  id: string,
  data: z.infer<typeof StepDefinitionValidation.updateStepDefinitionSchema>,
) => {
  const existing = await prisma.stepDefinition.findUnique({ where: { id } });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Step definition not found");
  }

  const result = await prisma.stepDefinition.update({
    where: { id },
    data,
  });

  return result;
};

export const StepDefinitionService = {
  getStepDefinitions,
  updateStepDefinition,
};

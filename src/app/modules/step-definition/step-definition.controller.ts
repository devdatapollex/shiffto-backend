import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { StepDefinitionService } from "./step-definition.service";

const getStepDefinitions = catchAsync(async (_req: Request, res: Response) => {
  const result = await StepDefinitionService.getStepDefinitions();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Step definitions fetched successfully",
    data: result,
  });
});

const updateStepDefinition = catchAsync(async (req: Request, res: Response) => {
  const result = await StepDefinitionService.updateStepDefinition(
    req.params.id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Step definition updated successfully",
    data: result,
  });
});

export const StepDefinitionController = {
  getStepDefinitions,
  updateStepDefinition,
};

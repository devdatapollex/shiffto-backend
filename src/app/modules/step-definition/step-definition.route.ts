import express from "express";
import authGuard from "../../middlewares/authGuard";
import validateRequest from "../../middlewares/validateRequest";
import { StepDefinitionController } from "./step-definition.controller";
import { StepDefinitionValidation } from "./step-definition.validation";

const router = express.Router();

router.get("/", authGuard(), StepDefinitionController.getStepDefinitions);

router.patch(
  "/:id",
  authGuard({ adminOnly: true }),
  validateRequest(StepDefinitionValidation.updateStepDefinitionSchema),
  StepDefinitionController.updateStepDefinition,
);

export const StepDefinitionRoutes = router;

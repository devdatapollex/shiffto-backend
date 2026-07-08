import express from "express";
import authGuard from "../../middlewares/authGuard";
import validateRequest from "../../middlewares/validateRequest";
import { ShipmentCategoryController } from "./shipment-category.controller";
import { ShipmentCategoryValidation } from "./shipment-category.validation";

const router = express.Router();

router.post(
  "/",
  authGuard({ adminOnly: true }),
  validateRequest(ShipmentCategoryValidation.createCategorySchema),
  ShipmentCategoryController.createCategory,
);

router.get(
  "/",
  authGuard({ adminOnly: true }),
  ShipmentCategoryController.getCategories,
);

router.get(
  "/:id",
  authGuard({ adminOnly: true }),
  ShipmentCategoryController.getCategoryById,
);

router.patch(
  "/:id",
  authGuard({ adminOnly: true }),
  validateRequest(ShipmentCategoryValidation.updateCategorySchema),
  ShipmentCategoryController.updateCategory,
);

router.delete(
  "/:id",
  authGuard({ adminOnly: true }),
  ShipmentCategoryController.deleteCategory,
);

export const ShipmentCategoryRoutes = router;

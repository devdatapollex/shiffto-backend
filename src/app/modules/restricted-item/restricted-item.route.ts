import express from "express";
import authGuard from "../../middlewares/authGuard";
import validateRequest from "../../middlewares/validateRequest";
import { RestrictedItemController } from "./restricted-item.controller";
import { RestrictedItemValidation } from "./restricted-item.validation";

const router = express.Router();

router.post(
  "/",
  authGuard({ adminOnly: true }),
  validateRequest(RestrictedItemValidation.createRestrictedItemSchema),
  RestrictedItemController.createItem,
);

router.get("/", authGuard(), RestrictedItemController.getItems);

router.get("/:id", authGuard(), RestrictedItemController.getItemById);

router.patch(
  "/:id",
  authGuard({ adminOnly: true }),
  validateRequest(RestrictedItemValidation.updateRestrictedItemSchema),
  RestrictedItemController.updateItem,
);

router.delete(
  "/:id",
  authGuard({ adminOnly: true }),
  RestrictedItemController.deleteItem,
);

export const RestrictedItemRoutes = router;

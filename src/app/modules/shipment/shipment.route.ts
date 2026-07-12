import express from "express";
import authGuard from "../../middlewares/authGuard";
import validateRequest from "../../middlewares/validateRequest";
import { ShipmentController } from "./shipment.controller";
import { ShipmentValidation } from "./shipment.validation";

const router = express.Router();

router.post(
  "/",
  authGuard(),
  validateRequest(ShipmentValidation.createShipmentSchema),
  ShipmentController.createShipment,
);

router.get("/", authGuard(), ShipmentController.getShipments);

router.get("/:id", authGuard(), ShipmentController.getShipmentById);

router.patch(
  "/:id",
  authGuard(),
  validateRequest(ShipmentValidation.updateShipmentSchema),
  ShipmentController.updateShipment,
);

router.delete("/:id", authGuard(), ShipmentController.deleteShipment);

export const ShipmentRoutes = router;

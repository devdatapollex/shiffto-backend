import express from "express";
import authGuard from "../../middlewares/authGuard";
import kycGuard from "../../middlewares/kycGuard";
import validateRequest from "../../middlewares/validateRequest";
import { ShipmentController } from "./shipment.controller";
import { ShipmentValidation } from "./shipment.validation";
import { ShipmentStepRoutes } from "./shipment-step.routes";
import { OfferController } from "../offer/offer.controller";

const router = express.Router();

// Mount step progression routes
router.use(ShipmentStepRoutes);

router.post(
  "/",
  authGuard(),
  kycGuard(),
  validateRequest(ShipmentValidation.createShipmentSchema),
  ShipmentController.createShipment,
);

router.post(
  "/send-otp",
  authGuard(),
  kycGuard(),
  ShipmentController.sendShipmentOtp,
);

router.get("/", authGuard(), ShipmentController.getShipments);

router.get("/:id/steps", authGuard(), ShipmentController.getShipmentSteps);

router.get("/:id/offers", authGuard(), OfferController.getOffersForShipment);

router.get("/:id/details", authGuard(), ShipmentController.getShipmentDetails);

router.get("/:id", authGuard(), ShipmentController.getShipmentById);

router.patch(
  "/:id",
  authGuard(),
  validateRequest(ShipmentValidation.updateShipmentSchema),
  ShipmentController.updateShipment,
);

router.delete("/:id", authGuard(), ShipmentController.deleteShipment);

export const ShipmentRoutes = router;

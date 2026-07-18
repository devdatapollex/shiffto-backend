import express from "express";
import authGuard from "../../middlewares/authGuard";
import validateRequest from "../../middlewares/validateRequest";
import { ShipmentStepController } from "./shipment-step.controller";
import { ShipmentStepValidation } from "./shipment-step.validation";

const router = express.Router();

// Payment confirmation (simulated for now)
router.post(
  "/:id/confirm-payment",
  authGuard(),
  ShipmentStepController.confirmPayment,
);

// Send delivery OTP to shipment owner
router.post(
  "/:id/send-delivery-otp",
  authGuard(),
  ShipmentStepController.sendDeliveryOtp,
);

// Step advancement routes
router.post(
  "/:id/steps/confirm-pickup",
  authGuard(),
  validateRequest(ShipmentStepValidation.confirmPickupSchema),
  ShipmentStepController.confirmPickup,
);

router.post(
  "/:id/steps/confirm-checkin",
  authGuard(),
  validateRequest(ShipmentStepValidation.confirmCheckinSchema),
  ShipmentStepController.confirmCheckin,
);

router.post(
  "/:id/steps/confirm-transit",
  authGuard(),
  validateRequest(ShipmentStepValidation.confirmTransitSchema),
  ShipmentStepController.confirmTransit,
);

router.post(
  "/:id/steps/confirm-arrival",
  authGuard(),
  validateRequest(ShipmentStepValidation.confirmArrivalSchema),
  ShipmentStepController.confirmArrival,
);

router.post(
  "/:id/steps/confirm-out-for-delivery",
  authGuard(),
  validateRequest(ShipmentStepValidation.confirmOutForDeliverySchema),
  ShipmentStepController.confirmOutForDelivery,
);

router.post(
  "/:id/steps/confirm-delivery",
  authGuard(),
  validateRequest(ShipmentStepValidation.confirmDeliverySchema),
  ShipmentStepController.confirmDelivery,
);

export const ShipmentStepRoutes = router;

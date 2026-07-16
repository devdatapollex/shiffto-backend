import express from "express";
import authGuard from "../../middlewares/authGuard";
import kycGuard from "../../middlewares/kycGuard";
import validateRequest from "../../middlewares/validateRequest";
import { TripController } from "./trip.controller";
import { TripValidation } from "./trip.validation";

const router = express.Router();

router.post(
  "/",
  authGuard(),
  kycGuard(),
  validateRequest(TripValidation.createTripSchema),
  TripController.createTrip,
);

router.get("/", authGuard(), TripController.getTrips);

router.get("/available-shipments", authGuard(), TripController.getAvailableShipments);

router.get("/:id", authGuard(), TripController.getTripById);

router.patch(
  "/:id",
  authGuard(),
  validateRequest(TripValidation.updateTripSchema),
  TripController.updateTrip,
);

router.post("/:id/cancel", authGuard(), TripController.cancelTrip);

router.post(
  "/:id/verify",
  authGuard({ adminOnly: true }),
  validateRequest(TripValidation.verifyTripSchema),
  TripController.verifyTrip,
);

router.post("/:id/accept-shipment", authGuard(), TripController.acceptShipment);

router.post("/:id/complete", authGuard(), TripController.completeTrip);

export const TripRoutes = router;

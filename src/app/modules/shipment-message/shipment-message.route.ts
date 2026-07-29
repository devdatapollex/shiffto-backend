import express from "express";
import authGuard from "../../middlewares/authGuard";
import { ShipmentMessageController } from "./shipment-message.controller";

const router = express.Router();

router.get(
  "/:shipmentId",
  authGuard(),
  ShipmentMessageController.getShipmentMessages,
);
router.post(
  "/:shipmentId",
  authGuard(),
  ShipmentMessageController.sendShipmentMessage,
);
router.patch(
  "/:shipmentId/read",
  authGuard(),
  ShipmentMessageController.markMessagesAsRead,
);

export const ShipmentMessageRoutes = router;

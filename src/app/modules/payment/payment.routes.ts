import express from "express";
import authGuard from "../../middlewares/authGuard";
import { PaymentController } from "./payment.controller";

const router = express.Router();

// Public webhook route (Stripe parses raw body)
router.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  PaymentController.handleStripeWebhook,
);

// Sender & Traveler Summaries
router.get("/sender-summary", authGuard(), PaymentController.getSenderSummary);
router.get(
  "/traveler-summary",
  authGuard(),
  PaymentController.getTravelerSummary,
);

// Admin Payments Overview & Listing
router.get(
  "/admin",
  authGuard({ adminOnly: true }),
  PaymentController.getAdminPayments,
);

// Admin Pending Refunds Queue
router.get(
  "/admin/refunds/pending",
  authGuard({ adminOnly: true }),
  PaymentController.getPendingRefunds,
);

// Admin Process Manual Refund
router.post(
  "/admin/refunds/:transactionId/process",
  authGuard({ adminOnly: true }),
  PaymentController.processAdminRefund,
);

// Admin Payment Release
router.post(
  "/:transactionId/release",
  authGuard({ adminOnly: true }),
  PaymentController.releasePayment,
);

// Admin Cancel Shipment with Custom Fee
router.post(
  "/admin/shipments/:id/cancel",
  authGuard({ adminOnly: true }),
  PaymentController.adminCancelShipment,
);

export const PaymentRoutes = router;

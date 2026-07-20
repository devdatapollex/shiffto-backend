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

// Admin Payment Release
router.post(
  "/:transactionId/release",
  authGuard({ adminOnly: true }),
  PaymentController.releasePayment,
);

export const PaymentRoutes = router;

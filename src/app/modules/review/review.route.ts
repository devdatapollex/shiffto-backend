import express from "express";
import authGuard from "../../middlewares/authGuard";
import validateRequest from "../../middlewares/validateRequest";
import { ReviewController } from "./review.controller";
import { ReviewValidation } from "./review.validation";

const router = express.Router();

router.post(
  "/",
  authGuard(),
  validateRequest(ReviewValidation.createReviewZodSchema),
  ReviewController.createReview,
);

router.get(
  "/shipment/:shipmentId",
  authGuard(),
  ReviewController.getShipmentReview,
);

router.get(
  "/user/:userId/stats",
  authGuard(),
  ReviewController.getUserReviewStats,
);

router.get(
  "/user/:userId/received",
  authGuard(),
  ReviewController.getUserReceivedReviews,
);

router.get(
  "/user/:userId/given",
  authGuard(),
  ReviewController.getUserGivenReviews,
);

export const ReviewRoutes = router;

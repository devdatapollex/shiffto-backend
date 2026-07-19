import express from "express";
import authGuard from "../../middlewares/authGuard";
import validateRequest from "../../middlewares/validateRequest";
import { OfferController } from "./offer.controller";
import { OfferValidation } from "./offer.validation";

const router = express.Router();

router.post(
  "/",
  authGuard(),
  validateRequest(OfferValidation.createOfferSchema),
  OfferController.createOffer,
);

router.get("/sent", authGuard(), OfferController.getSentOffers);
router.get("/received", authGuard(), OfferController.getReceivedOffers);

router.post("/:id/accept", authGuard(), OfferController.acceptOffer);
router.post(
  "/:id/cancel-checkout",
  authGuard(),
  OfferController.cancelCheckout,
);
router.delete("/:id", authGuard(), OfferController.rejectOffer);

export const OfferRoutes = router;

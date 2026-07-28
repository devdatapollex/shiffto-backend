import express from "express";
import authGuard from "../../middlewares/authGuard";
import validateRequest from "../../middlewares/validateRequest";
import { ProfileController } from "./profile.controller";
import { ProfileValidation } from "./profile.validation";

const router = express.Router();

router.get("/", authGuard(), ProfileController.getProfile);
router.get("/analytics", authGuard(), ProfileController.getAnalytics);
router.get("/revenue-chart", authGuard(), ProfileController.getRevenueChart);
router.get("/shipment-chart", authGuard(), ProfileController.getShipmentChart);

router.patch(
  "/",
  authGuard(),
  validateRequest(ProfileValidation.updateProfileSchema),
  ProfileController.updateProfile,
);

router.post(
  "/change-password",
  authGuard(),
  validateRequest(ProfileValidation.changePasswordSchema),
  ProfileController.changePassword,
);

router.post(
  "/kyc",
  authGuard(),
  validateRequest(ProfileValidation.submitKycSchema),
  ProfileController.submitKyc,
);

router.post("/deactivate", authGuard(), ProfileController.deactivateAccount);

router.post(
  "/delete",
  authGuard(),
  validateRequest(ProfileValidation.deleteAccountSchema),
  ProfileController.deleteAccount,
);

router.post("/abort-signup", ProfileController.abortSignup);

export const ProfileRoutes = router;

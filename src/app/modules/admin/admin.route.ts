import express from "express";
import authGuard from "../../middlewares/authGuard";
import validateRequest from "../../middlewares/validateRequest";
import { AdminController } from "./admin.controller";
import { AdminValidation } from "./admin.validation";

const router = express.Router();

router.get(
  "/analytics",
  authGuard({ adminOnly: true }),
  AdminController.getAdminAnalytics,
);

router.get(
  "/sidebar-counts",
  authGuard({ adminOnly: true }),
  AdminController.getSidebarCounts,
);

router.get(
  "/kyc",
  authGuard({ adminOnly: true }),
  AdminController.getKycSubmissions,
);

router.patch(
  "/kyc/:id",
  authGuard({ adminOnly: true }),
  validateRequest(AdminValidation.reviewKycSchema),
  AdminController.reviewKyc,
);

router.patch(
  "/users/:id/reactivate",
  authGuard({ adminOnly: true }),
  AdminController.reactivateUser,
);

export const AdminRoutes = router;

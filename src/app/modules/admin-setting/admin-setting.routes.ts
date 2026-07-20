import express from "express";
import authGuard from "../../middlewares/authGuard";
import { AdminSettingController } from "./admin-setting.controller";

const router = express.Router();

router.get(
  "/",
  authGuard({ adminOnly: true }),
  AdminSettingController.getSettings,
);
router.patch(
  "/commission-rate",
  authGuard({ adminOnly: true }),
  AdminSettingController.updateCommissionRate,
);

export const AdminSettingRoutes = router;

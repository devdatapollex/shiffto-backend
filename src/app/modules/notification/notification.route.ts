import express from "express";
import authGuard from "../../middlewares/authGuard";
import { NotificationController } from "./notification.controller";

const router = express.Router();

router.get("/", authGuard(), NotificationController.getMyNotifications);
router.patch("/read-all", authGuard(), NotificationController.markAllAsRead);
router.patch("/:id/read", authGuard(), NotificationController.markAsRead);

export const NotificationRoutes = router;

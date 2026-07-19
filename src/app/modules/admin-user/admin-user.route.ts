import express from "express";
import authGuard from "../../middlewares/authGuard";
import { AdminUserController } from "./admin-user.controller";

const router = express.Router();

router.get(
  "/",
  authGuard({ adminOnly: true }),
  AdminUserController.getAllUsers
);

router.get(
  "/:id",
  authGuard({ adminOnly: true }),
  AdminUserController.getUserDetail
);

router.patch(
  "/:id",
  authGuard({ adminOnly: true }),
  AdminUserController.updateUser
);

router.post(
  "/bulk",
  authGuard({ adminOnly: true }),
  AdminUserController.bulkActionUsers
);

export const AdminUserRoutes = router;

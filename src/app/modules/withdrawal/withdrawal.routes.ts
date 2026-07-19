import express from "express";
import authGuard from "../../middlewares/authGuard";
import { WithdrawalController } from "./withdrawal.controller";

const router = express.Router();

router.post("/request", authGuard(), WithdrawalController.requestWithdrawal);
router.get("/my-withdrawals", authGuard(), WithdrawalController.getMyWithdrawals);

// Admin Routes
router.get("/admin/all", authGuard({ adminOnly: true }), WithdrawalController.getAllWithdrawals);
router.patch("/admin/:id/approve", authGuard({ adminOnly: true }), WithdrawalController.approveWithdrawal);
router.patch("/admin/:id/reject", authGuard({ adminOnly: true }), WithdrawalController.rejectWithdrawal);

export const WithdrawalRoutes = router;

import express from "express";
import authGuard from "../../middlewares/authGuard";
import { WalletController } from "./wallet.controller";

const router = express.Router();

router.get("/", authGuard(), WalletController.getMyPaymentMethods);
router.post("/", authGuard(), WalletController.addPaymentMethod);
router.put("/:id", authGuard(), WalletController.updatePaymentMethod);
router.delete("/:id", authGuard(), WalletController.deletePaymentMethod);
router.patch("/:id/primary", authGuard(), WalletController.setPrimaryPaymentMethod);

export const WalletRoutes = router;

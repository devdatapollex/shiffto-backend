import express, { Router } from "express";
import { ShipmentRoutes } from "../modules/shipment/shipment.route";
import { ShipmentCategoryRoutes } from "../modules/shipment-category/shipment-category.route";
import { UploadRoutes } from "../modules/upload/upload.route";
import { TripRoutes } from "../modules/trip/trip.route";
import { ProfileRoutes } from "../modules/profile/profile.route";
import { AdminRoutes } from "../modules/admin/admin.route";
import { NotificationRoutes } from "../modules/notification/notification.route";
import { StepDefinitionRoutes } from "../modules/step-definition/step-definition.route";
import { OfferRoutes } from "../modules/offer/offer.route";
import { TicketRoutes } from "../modules/ticket/ticket.route";
import { PaymentRoutes } from "../modules/payment/payment.routes";
import { WalletRoutes } from "../modules/wallet/wallet.routes";
import { WithdrawalRoutes } from "../modules/withdrawal/withdrawal.routes";
import { AdminSettingRoutes } from "../modules/admin-setting/admin-setting.routes";
import { AdminUserRoutes } from "../modules/admin-user/admin-user.route";
import { RestrictedItemRoutes } from "../modules/restricted-item/restricted-item.route";
import { ShipmentMessageRoutes } from "../modules/shipment-message/shipment-message.route";
import { ReviewRoutes } from "../modules/review/review.route";

import { getLatestOtp } from "../lib/email";

const router = express.Router();

router.get("/auth/latest-otp", (req, res) => {
  const email = (req.query.email as string) || "";
  const type = req.query.type as string | undefined;
  const otp = getLatestOtp(email, type);
  res.json({
    success: true,
    data: { otp },
  });
});

const moduleRoutes: { path: string; route: Router }[] = [
  { path: "/shipments", route: ShipmentRoutes },
  { path: "/shipment-messages", route: ShipmentMessageRoutes },
  { path: "/shipment-categories", route: ShipmentCategoryRoutes },
  { path: "/shipments-steps", route: StepDefinitionRoutes },
  { path: "/uploads/photos", route: UploadRoutes },
  { path: "/trips", route: TripRoutes },
  { path: "/profile", route: ProfileRoutes },
  { path: "/admin", route: AdminRoutes },
  { path: "/notifications", route: NotificationRoutes },
  { path: "/offers", route: OfferRoutes },
  { path: "/tickets", route: TicketRoutes },
  { path: "/payments", route: PaymentRoutes },
  { path: "/wallet", route: WalletRoutes },
  { path: "/withdrawals", route: WithdrawalRoutes },
  { path: "/admin/settings", route: AdminSettingRoutes },
  { path: "/admin-users", route: AdminUserRoutes },
  { path: "/restricted-items", route: RestrictedItemRoutes },
  { path: "/reviews", route: ReviewRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));
export default router;

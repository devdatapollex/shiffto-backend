import express, { Router } from "express";
import { ShipmentRoutes } from "../modules/shipment/shipment.route";
import { ShipmentCategoryRoutes } from "../modules/shipment-category/shipment-category.route";
import { UploadRoutes } from "../modules/upload/upload.route";

const router = express.Router();

const moduleRoutes: { path: string; route: Router }[] = [
  { path: "/shipments", route: ShipmentRoutes },
  { path: "/shipment-categories", route: ShipmentCategoryRoutes },
  { path: "/uploads/photos", route: UploadRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;

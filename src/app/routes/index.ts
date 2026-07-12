import express, { Router } from "express";
import { ShipmentRoutes } from "../modules/shipment/shipment.route";
import { ShipmentCategoryRoutes } from "../modules/shipment-category/shipment-category.route";

const router = express.Router();

const moduleRoutes: { path: string; route: Router }[] = [
  { path: "/shipments", route: ShipmentRoutes },
  { path: "/shipment-categories", route: ShipmentCategoryRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;

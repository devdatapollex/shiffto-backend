import swaggerUi from "swagger-ui-express";
import { Router } from "express";
import { openapiDoc } from "./openapi";

const router = Router();

router.get("/openapi.json", (_req, res) => {
  res.json(openapiDoc);
});

router.use("/", swaggerUi.serve, swaggerUi.setup(openapiDoc));

export default router;

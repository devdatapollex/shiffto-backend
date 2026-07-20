import express, { Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import notFound from "./app/middlewares/notFound";
import router from "./app/routes/index";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./app/lib/auth";
import config from "./config/index";
import docsRouter from "./app/docs/route";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import { PaymentController } from "./app/modules/payment/payment.controller";

const app: Application = express();
app.use(
  cors({
    origin: config.frontend_url,
    credentials: true,
  }),
);

app.all("/api/auth/{*any}", toNodeHandler(auth));

// Stripe webhook route (MUST be mounted BEFORE express.json() to preserve raw Buffer body for HMAC verification)
app.post(
  "/api/v1/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  PaymentController.handleStripeWebhook,
);

// Body Parsers for all other routes
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api/v1", router);

app.use("/api/docs", docsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(globalErrorHandler);

app.use(notFound);

export default app;

import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import notFound from "./app/middlewares/notFound";
import router from "./app/routes/index";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./app/lib/auth";
import config from "./config/index";
import docsRouter from "./app/docs/route";

const app: Application = express();
app.use(
  cors({
    origin: config.frontend_url,
    credentials: true,
  }),
);

app.all("/api/auth/{*any}", toNodeHandler(auth));

//parser
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use("/api/v1", router);

app.use("/api/docs", docsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(globalErrorHandler);

app.use(notFound);

export default app;

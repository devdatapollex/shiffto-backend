import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

type EnvInput = Record<string, string | undefined>;

export const createConfig = (env: EnvInput) => {
  if (!env.DATABASE_URL) {
    throw new Error(
      "Invalid environment configuration: DATABASE_URL is required",
    );
  }

  const port = Number(env.PORT ?? 5000);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      "Invalid environment configuration: PORT must be a positive integer",
    );
  }

  return {
    node_env: env.NODE_ENV ?? "development",
    port,
    database_url: env.DATABASE_URL,
    frontend_url: env.FRONTEND_URL ?? "http://localhost:3000",
    mobile_app_url: env.MOBILE_APP_URL ?? "myapp://auth",
    smtp: {
      service: env.SMTP_SERVICE ?? "",
      host: env.SMTP_HOST ?? "",
      port: Number(env.SMTP_PORT ?? 587),
      user: env.SMTP_USER ?? "",
      pass: env.SMTP_PASS ?? "",
      from: env.SMTP_FROM ?? "",
    },
    r2: {
      account_id: env.CLOUDFLARE_ACCOUNT_ID ?? "",
      access_key_id: env.R2_ACCESS_KEY_ID ?? "",
      secret_access_key: env.R2_SECRET_ACCESS_KEY ?? "",
      public_bucket: env.R2_PUBLIC_BUCKET ?? "",
      public_url: env.R2_PUBLIC_URL ?? "",
      private_bucket: env.R2_PRIVATE_BUCKET ?? "",
    },
    google: {
      client_id: env.GOOGLE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
    },
  };
};

const config = createConfig(process.env);

export default config;

import { describe, expect, it } from "vitest";
import { createConfig } from "../../src/config/index";

describe("createConfig", () => {
  it("normalizes configured values and defaults", () => {
    const config = createConfig({
      NODE_ENV: "test",
      PORT: "7000",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/shiffto",
      FRONTEND_URL: "http://localhost:3001",
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      R2_ACCESS_KEY_ID: "access-key",
      R2_SECRET_ACCESS_KEY: "secret-key",
      R2_PUBLIC_BUCKET: "shiffto-public",
      R2_PUBLIC_URL: "https://cdn.shiffto.com",
      R2_PRIVATE_BUCKET: "shiffto-private",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_USER: "user@example.com",
      SMTP_PASS: "smtp-password",
      SMTP_FROM: "noreply@example.com",
    });

    expect(config).toEqual({
      node_env: "test",
      port: 7000,
      database_url: "postgresql://user:pass@localhost:5432/shiffto",
      frontend_url: "http://localhost:3001",
      r2: {
        account_id: "account-id",
        access_key_id: "access-key",
        secret_access_key: "secret-key",
        public_bucket: "shiffto-public",
        public_url: "https://cdn.shiffto.com",
        private_bucket: "shiffto-private",
      },
      google: {
        client_id: "google-client-id",
        client_secret: "google-client-secret",
      },
      smtp: {
        service: "",
        host: "smtp.example.com",
        port: 587,
        user: "user@example.com",
        pass: "smtp-password",
        from: "noreply@example.com",
      },
    });
  });

  it("uses development defaults for optional local settings", () => {
    const config = createConfig({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/shiffto",
    });

    expect(config.node_env).toBe("development");
    expect(config.port).toBe(5000);
    expect(config.frontend_url).toBe("http://localhost:3000");
    expect(config.r2.private_bucket).toBe("");
    expect(config.google.client_id).toBe("");
    expect(config.google.client_secret).toBe("");
    expect(config.smtp.service).toBe("");
    expect(config.smtp.host).toBe("");
    expect(config.smtp.port).toBe(587);
    expect(config.smtp.user).toBe("");
    expect(config.smtp.pass).toBe("");
    expect(config.smtp.from).toBe("");
  });

  it("throws a readable error when required config is missing", () => {
    expect(() => createConfig({})).toThrow(
      "Invalid environment configuration: DATABASE_URL is required",
    );
  });
});

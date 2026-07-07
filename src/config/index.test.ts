import { describe, expect, it } from "vitest";
import { createConfig } from "./index";

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
      JWT_SECRET: "jwt-secret",
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
      jwt_secret: "jwt-secret",
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
  });

  it("throws a readable error when required config is missing", () => {
    expect(() => createConfig({})).toThrow(
      "Invalid environment configuration: DATABASE_URL is required",
    );
  });
});

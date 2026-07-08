import { beforeEach, describe, expect, it, vi } from "vitest";

const betterAuthMock = vi.fn((options: unknown) => ({ options }));
const prismaAdapterMock = vi.fn(() => "prisma-adapter");
const adminPluginMock = vi.fn((options: unknown) => ({ id: "admin", options }));
const openAPIMock = vi.fn(() => ({ id: "open-api" }));

vi.mock("better-auth", () => ({
  betterAuth: betterAuthMock,
}));

vi.mock("better-auth/adapters/prisma", () => ({
  prismaAdapter: prismaAdapterMock,
}));

vi.mock("better-auth/plugins", () => ({
  admin: adminPluginMock,
  openAPI: openAPIMock,
}));

vi.mock("../../../src/app/lib/prisma", () => ({
  default: "prisma-client",
}));

describe("auth configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    betterAuthMock.mockClear();
    prismaAdapterMock.mockClear();
    adminPluginMock.mockClear();
    openAPIMock.mockClear();
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/shiffto";
    process.env.FRONTEND_URL = "http://localhost:3000";
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
  });

  it("configures Better Auth for the Next.js frontend auth contract", async () => {
    const { ac, admin, user } = await import("../../../src/config/permissions");

    await import("../../../src/app/lib/auth");

    expect(prismaAdapterMock).toHaveBeenCalledWith("prisma-client", {
      provider: "postgresql",
    });
    expect(adminPluginMock).toHaveBeenCalledWith({
      ac,
      roles: { admin, user },
      defaultRole: "user",
    });
    expect(openAPIMock).toHaveBeenCalledOnce();
    expect(betterAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        database: "prisma-adapter",
        emailAndPassword: { enabled: true },
        socialProviders: {
          google: {
            clientId: "google-client-id",
            clientSecret: "google-client-secret",
          },
        },
        trustedOrigins: ["http://localhost:3000"],
        plugins: [
          {
            id: "admin",
            options: { ac, roles: { admin, user }, defaultRole: "user" },
          },
          { id: "open-api" },
        ],
      }),
    );
  });
});

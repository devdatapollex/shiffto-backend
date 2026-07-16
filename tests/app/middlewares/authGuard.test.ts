import { Request, Response, NextFunction } from "express";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ApiError from "../../../src/app/errors/ApiError";

const mockGetSession = vi.fn();
const mockFromNodeHeaders = vi.fn((headers: unknown) => headers);
const mockUserFindUnique = vi.fn();

vi.mock("better-auth/node", () => ({
  fromNodeHeaders: mockFromNodeHeaders,
}));

vi.mock("../../../src/app/lib/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("../../../src/app/lib/prisma", () => ({
  default: {
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

const buildReq = (overrides = {}) =>
  ({
    headers: { cookie: "session=abc" },
    ...overrides,
  }) as unknown as Request;

describe("authGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindUnique.mockImplementation(async () => {
      const session = await mockGetSession.mock.results[0]?.value;
      return session?.user || null;
    });
  });

  const importAuthGuard = () =>
    import("../../../src/app/middlewares/authGuard");

  it("throws 401 when no session exists", async () => {
    mockGetSession.mockResolvedValue(null);

    const { default: authGuard } = await importAuthGuard();
    const middleware = authGuard();
    const next = vi.fn();

    await middleware(buildReq(), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0]![0] as ApiError;
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Not authenticated");
  });

  it("throws 401 when session has no user", async () => {
    mockGetSession.mockResolvedValue({ user: null });

    const { default: authGuard } = await importAuthGuard();
    const middleware = authGuard();
    const next = vi.fn();

    await middleware(buildReq(), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0]![0] as ApiError;
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Not authenticated");
  });

  it("attaches user to request and calls next for verified user", async () => {
    const user = {
      id: "user-1",
      email: "test@example.com",
      emailVerified: true,
      role: "user",
      name: "Test",
      banned: null,
    };
    mockGetSession.mockResolvedValue({ user });

    const { default: authGuard } = await importAuthGuard();
    const middleware = authGuard();
    const req = buildReq();
    const next = vi.fn();

    await middleware(req, {} as Response, next);

    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalledWith();
  });

  it("throws 403 for unverified normal user", async () => {
    const user = {
      id: "user-1",
      email: "test@example.com",
      emailVerified: false,
      role: "user",
      name: "Test",
      banned: null,
    };
    mockGetSession.mockResolvedValue({ user });

    const { default: authGuard } = await importAuthGuard();
    const middleware = authGuard();
    const next = vi.fn();

    await middleware(buildReq(), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0]![0] as ApiError;
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe("Email verification required");
  });

  it("does not check verification for admin user", async () => {
    const user = {
      id: "admin-1",
      email: "admin@example.com",
      emailVerified: false,
      role: "admin",
      name: "Admin",
      banned: null,
    };
    mockGetSession.mockResolvedValue({ user });

    const { default: authGuard } = await importAuthGuard();
    const middleware = authGuard();
    const req = buildReq();
    const next = vi.fn();

    await middleware(req, {} as Response, next);

    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalledWith();
  });

  it("throws 403 for non-admin user when adminOnly is true", async () => {
    const user = {
      id: "user-1",
      email: "test@example.com",
      emailVerified: true,
      role: "user",
      name: "Test",
      banned: null,
    };
    mockGetSession.mockResolvedValue({ user });

    const { default: authGuard } = await importAuthGuard();
    const middleware = authGuard({ adminOnly: true });
    const next = vi.fn();

    await middleware(buildReq(), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0]![0] as ApiError;
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe("Admin access required");
  });

  it("allows admin user when adminOnly is true", async () => {
    const user = {
      id: "admin-1",
      email: "admin@example.com",
      emailVerified: true,
      role: "admin",
      name: "Admin",
      banned: null,
    };
    mockGetSession.mockResolvedValue({ user });

    const { default: authGuard } = await importAuthGuard();
    const middleware = authGuard({ adminOnly: true });
    const req = buildReq();
    const next = vi.fn();

    await middleware(req, {} as Response, next);

    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalledWith();
  });
});

import { Request, Response } from "express";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ApiError from "../../../src/app/errors/ApiError";

const mockKycFindUnique = vi.fn();

vi.mock("../../../src/app/lib/prisma", () => ({
  default: {
    kyc: {
      findUnique: mockKycFindUnique,
    },
  },
}));

const buildReq = (user?: any) =>
  ({
    user,
  }) as unknown as Request;

describe("kycGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const importKycGuard = () => import("../../../src/app/middlewares/kycGuard");

  it("throws 401 when req.user is missing", async () => {
    const { default: kycGuard } = await importKycGuard();
    const middleware = kycGuard();
    const next = vi.fn();

    await middleware(buildReq(), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0]![0] as ApiError;
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Not authenticated");
  });

  it("allows admin user without checking KYC database", async () => {
    const { default: kycGuard } = await importKycGuard();
    const middleware = kycGuard();
    const next = vi.fn();
    const user = { id: "admin-1", role: "admin" };

    await middleware(buildReq(user), {} as Response, next);

    expect(mockKycFindUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it("throws 403 when user has no KYC record", async () => {
    mockKycFindUnique.mockResolvedValue(null);

    const { default: kycGuard } = await importKycGuard();
    const middleware = kycGuard();
    const next = vi.fn();
    const user = { id: "user-1", role: "user" };

    await middleware(buildReq(user), {} as Response, next);

    expect(mockKycFindUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0]![0] as ApiError;
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain("KYC verification is required");
  });

  it("throws 403 when user KYC status is PENDING", async () => {
    mockKycFindUnique.mockResolvedValue({
      id: "kyc-1",
      userId: "user-1",
      status: "PENDING",
    });

    const { default: kycGuard } = await importKycGuard();
    const middleware = kycGuard();
    const next = vi.fn();
    const user = { id: "user-1", role: "user" };

    await middleware(buildReq(user), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0]![0] as ApiError;
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain("Your status must be APPROVED");
  });

  it("throws 403 when user KYC status is REJECTED", async () => {
    mockKycFindUnique.mockResolvedValue({
      id: "kyc-1",
      userId: "user-1",
      status: "REJECTED",
    });

    const { default: kycGuard } = await importKycGuard();
    const middleware = kycGuard();
    const next = vi.fn();
    const user = { id: "user-1", role: "user" };

    await middleware(buildReq(user), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0]![0] as ApiError;
    expect(error.statusCode).toBe(403);
  });

  it("calls next() when user KYC status is APPROVED", async () => {
    mockKycFindUnique.mockResolvedValue({
      id: "kyc-1",
      userId: "user-1",
      status: "APPROVED",
    });

    const { default: kycGuard } = await importKycGuard();
    const middleware = kycGuard();
    const next = vi.fn();
    const user = { id: "user-1", role: "user" };

    await middleware(buildReq(user), {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });
});

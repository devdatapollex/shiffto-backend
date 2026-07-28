import { describe, expect, it, vi, beforeEach } from "vitest";
import ApiError from "../../../../src/app/errors/ApiError";

const mockKycFindUnique = vi.fn();
const mockTransaction = vi.fn();
const mockKycUpdate = vi.fn();
const mockUserUpdate = vi.fn();

vi.mock("../../../../src/app/lib/prisma", () => ({
  default: {
    kyc: {
      findUnique: mockKycFindUnique,
      update: mockKycUpdate,
    },
    user: {
      update: mockUserUpdate,
    },
    $transaction: mockTransaction,
  },
}));

describe("AdminService.reviewKyc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const importAdminService = async () => {
    const { AdminService } =
      await import("../../../../src/app/modules/admin/admin.service");
    return AdminService;
  };

  it("throws 404 ApiError if KYC submission not found", async () => {
    mockKycFindUnique.mockResolvedValue(null);
    const AdminService = await importAdminService();

    await expect(
      AdminService.reviewKyc("invalid-id", "APPROVED"),
    ).rejects.toThrow(ApiError);
  });

  it("updates KYC status and User phone in a transaction when status is APPROVED", async () => {
    const mockKyc = {
      id: "kyc-123",
      userId: "user-456",
      phoneNumber: "+1234567890",
      status: "PENDING",
    };
    mockKycFindUnique.mockResolvedValue(mockKyc);

    mockTransaction.mockImplementation(async (callback: any) => {
      const tx = {
        kyc: {
          update: mockKycUpdate.mockResolvedValue({
            ...mockKyc,
            status: "APPROVED",
            rejectionReason: null,
          }),
        },
        user: {
          update: mockUserUpdate.mockResolvedValue({
            id: "user-456",
            phone: "+1234567890",
          }),
        },
      };
      return callback(tx);
    });

    const AdminService = await importAdminService();
    const result = await AdminService.reviewKyc("kyc-123", "APPROVED");

    expect(mockKycFindUnique).toHaveBeenCalledWith({
      where: { id: "kyc-123" },
    });
    expect(mockKycUpdate).toHaveBeenCalledWith({
      where: { id: "kyc-123" },
      data: { status: "APPROVED", rejectionReason: null },
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-456" },
      data: { phone: "+1234567890" },
    });
    expect(result.status).toBe("APPROVED");
  });

  it("updates KYC status without updating User phone when status is REJECTED", async () => {
    const mockKyc = {
      id: "kyc-123",
      userId: "user-456",
      phoneNumber: "+1234567890",
      status: "PENDING",
    };
    mockKycFindUnique.mockResolvedValue(mockKyc);

    mockTransaction.mockImplementation(async (callback: any) => {
      const tx = {
        kyc: {
          update: mockKycUpdate.mockResolvedValue({
            ...mockKyc,
            status: "REJECTED",
            rejectionReason: "Invalid doc",
          }),
        },
        user: {
          update: mockUserUpdate,
        },
      };
      return callback(tx);
    });

    const AdminService = await importAdminService();
    const result = await AdminService.reviewKyc(
      "kyc-123",
      "REJECTED",
      "Invalid doc",
    );

    expect(mockKycUpdate).toHaveBeenCalledWith({
      where: { id: "kyc-123" },
      data: { status: "REJECTED", rejectionReason: "Invalid doc" },
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(result.status).toBe("REJECTED");
  });
});

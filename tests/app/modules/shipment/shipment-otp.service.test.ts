import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSendVerificationOTP = vi.fn();

vi.mock("../../../../src/app/lib/email", () => ({
  sendVerificationOTP: mockSendVerificationOTP,
}));

const mockVerification = {
  findFirst: vi.fn(),
  deleteMany: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
};

vi.mock("../../../../src/app/lib/prisma", () => ({
  default: {
    verification: mockVerification,
  },
}));

describe("ShipmentOtpService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const importService = () =>
    import("../../../../src/app/modules/shipment/shipment-otp.service");

  describe("generateAndSendShipmentOtp", () => {
    it("creates a verification record and sends the OTP email", async () => {
      mockVerification.create.mockResolvedValue({});
      const { ShipmentOtpService } = await importService();

      await ShipmentOtpService.generateAndSendShipmentOtp("User@Example.com");

      expect(mockVerification.deleteMany).toHaveBeenCalledWith({
        where: { identifier: "shipment-verification-otp-user@example.com" },
      });
      expect(mockVerification.create).toHaveBeenCalledTimes(1);
      const createCall = mockVerification.create.mock.calls[0][0];
      expect(createCall.data.identifier).toBe(
        "shipment-verification-otp-user@example.com",
      );
      expect(createCall.data.value).toMatch(/^\d{6}:0$/);
      expect(createCall.data.id).toBeTruthy();
      expect(new Date(createCall.data.expiresAt).getTime()).toBeGreaterThan(
        Date.now(),
      );

      expect(mockSendVerificationOTP).toHaveBeenCalledTimes(1);
      const sendCall = mockSendVerificationOTP.mock.calls[0][0];
      expect(sendCall.email).toBe("User@Example.com");
      expect(sendCall.type).toBe("shipment-verification");
      expect(sendCall.otp).toMatch(/^\d{6}$/);
    });

    it("generates 6-digit OTPs with leading zeros", async () => {
      mockVerification.create.mockResolvedValue({});
      const { ShipmentOtpService } = await importService();

      for (let i = 0; i < 20; i++) {
        await ShipmentOtpService.generateAndSendShipmentOtp("a@b.com");
      }
      for (const call of mockSendVerificationOTP.mock.calls) {
        expect(call[0].otp).toMatch(/^\d{6}$/);
      }
    });
  });

  describe("verifyShipmentOtp", () => {
    const email = "user@example.com";
    const validRecord = {
      id: "otp-id",
      identifier: "shipment-verification-otp-user@example.com",
      value: "123456:0",
      expiresAt: new Date(Date.now() + 60_000),
    };

    it("consumes the OTP and returns silently on a valid match", async () => {
      mockVerification.findFirst.mockResolvedValue(validRecord);
      const { ShipmentOtpService } = await importService();

      await expect(
        ShipmentOtpService.verifyShipmentOtp(email, "123456"),
      ).resolves.toBeUndefined();
      expect(mockVerification.delete).toHaveBeenCalledWith({
        where: { id: "otp-id" },
      });
    });

    it("throws 400 when the record is missing", async () => {
      mockVerification.findFirst.mockResolvedValue(null);
      const { ShipmentOtpService } = await importService();

      await expect(
        ShipmentOtpService.verifyShipmentOtp(email, "123456"),
      ).rejects.toMatchObject({ statusCode: 400, message: "Invalid OTP" });
      expect(mockVerification.delete).not.toHaveBeenCalled();
    });

    it("throws 400 and deletes the record when expired", async () => {
      mockVerification.findFirst.mockResolvedValue({
        ...validRecord,
        expiresAt: new Date(Date.now() - 1000),
      });
      const { ShipmentOtpService } = await importService();

      await expect(
        ShipmentOtpService.verifyShipmentOtp(email, "123456"),
      ).rejects.toMatchObject({ statusCode: 400, message: "OTP expired" });
      expect(mockVerification.deleteMany).toHaveBeenCalledWith({
        where: { identifier: validRecord.identifier },
      });
    });

    it("increments attempts and throws 400 on a wrong code", async () => {
      mockVerification.findFirst.mockResolvedValue(validRecord);
      const { ShipmentOtpService } = await importService();

      await expect(
        ShipmentOtpService.verifyShipmentOtp(email, "000000"),
      ).rejects.toMatchObject({ statusCode: 400, message: "Invalid OTP" });
      expect(mockVerification.update).toHaveBeenCalledWith({
        where: { id: "otp-id" },
        data: { value: "123456:1" },
      });
      expect(mockVerification.delete).not.toHaveBeenCalled();
    });

    it("throws 403 and deletes the record when max attempts exceeded", async () => {
      mockVerification.findFirst.mockResolvedValue({
        ...validRecord,
        value: "123456:3",
      });
      const { ShipmentOtpService } = await importService();

      await expect(
        ShipmentOtpService.verifyShipmentOtp(email, "123456"),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(mockVerification.deleteMany).toHaveBeenCalledWith({
        where: { identifier: validRecord.identifier },
      });
    });
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import ApiError from "../../../src/app/errors/ApiError";

const mockFileUploader = {
  deletePublicFile: vi.fn(() => Promise.resolve()),
  extractKey: vi.fn((url: string) =>
    url.replace("https://cdn.shiffto.com/", ""),
  ),
};

vi.mock("../../../../src/app/helper/fileUploader", () => ({
  fileUploader: mockFileUploader,
}));

const mockShipment = {
  create: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockCategory = {
  findUnique: vi.fn(),
};

const mockVerification = {
  findFirst: vi.fn(),
  deleteMany: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
};

const mockPrisma = {
  shipment: mockShipment,
  shipmentCategory: mockCategory,
  verification: mockVerification,
  $transaction: vi.fn((cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
    cb(mockPrisma),
  ),
};

vi.mock("../../../../src/app/lib/prisma", () => ({
  default: mockPrisma,
}));

const fullData = {
  itemName: "Laptop",
  weight: 5,
  quantity: 2,
  description: "A laptop",
  itemPhotos: [],
  instructions: "Handle with care",
  fromCountry: "US",
  toCountry: "BD",
  pricePerKg: 100,
  receiverName: "John Doe",
  receiverPhone: "123456",
  receiverAddress: "123 Main St",
  categoryId: "cat-1",
  otp: "123456",
};

const userId = "user-1";
const mockUser = {
  id: userId,
  email: "user@example.com",
  role: "user" as const,
};

const validOtpRecord = {
  id: "otp-1",
  identifier: "shipment-verification-otp-user@example.com",
  value: "123456:0",
  expiresAt: new Date(Date.now() + 60_000),
};

describe("ShipmentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    mockVerification.findFirst.mockResolvedValue(validOtpRecord);
    mockVerification.delete.mockResolvedValue(validOtpRecord);
  });

  const importService = () =>
    import("../../../../src/app/modules/shipment/shipment.service");

  describe("createShipment", () => {
    it("creates a shipment when constraints are met and OTP is valid", async () => {
      mockCategory.findUnique.mockResolvedValue({
        id: "cat-1",
        minPrice: 10,
        maxWeight: 10,
        maxQuantity: 5,
        maxPrice: 200,
      });
      mockShipment.create.mockResolvedValue({
        id: "ship-1",
        ...fullData,
        userId,
      });

      const { ShipmentService } = await importService();
      const result = await ShipmentService.createShipment(fullData, mockUser);

      const { otp: _otp, ...shipmentData } = fullData;

      expect(result.id).toBe("ship-1");
      expect(mockShipment.create).toHaveBeenCalledWith({
        data: { ...shipmentData, userId },
        include: { category: true },
      });
      const createCallData = mockShipment.create.mock.calls[0][0].data;
      expect(createCallData).not.toHaveProperty("otp");
    });

    it("does not include otp in the persisted shipment", async () => {
      mockCategory.findUnique.mockResolvedValue({
        id: "cat-1",
        minPrice: 10,
      });
      mockShipment.create.mockResolvedValue({ id: "ship-1" });

      const { ShipmentService } = await importService();
      await ShipmentService.createShipment(fullData, mockUser);

      const createCall = mockShipment.create.mock.calls[0][0];
      expect(createCall.data).not.toHaveProperty("otp");
      expect(createCall.data).toHaveProperty("categoryId", "cat-1");
    });

    it("consumes the OTP after a successful create", async () => {
      mockCategory.findUnique.mockResolvedValue({ id: "cat-1", minPrice: 10 });
      mockShipment.create.mockResolvedValue({ id: "ship-1" });

      const { ShipmentService } = await importService();
      await ShipmentService.createShipment(fullData, mockUser);

      expect(mockVerification.delete).toHaveBeenCalledWith({
        where: { id: validOtpRecord.id },
      });
    });

    it("throws 400 and does not create shipment when OTP is invalid", async () => {
      mockVerification.findFirst.mockResolvedValue({
        ...validOtpRecord,
        value: "999999:0",
      });

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.createShipment(fullData, mockUser),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockShipment.create).not.toHaveBeenCalled();
    });

    it("throws 400 when OTP record is missing", async () => {
      mockVerification.findFirst.mockResolvedValue(null);

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.createShipment(fullData, mockUser),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockShipment.create).not.toHaveBeenCalled();
    });

    it("throws 400 when OTP is expired", async () => {
      mockVerification.findFirst.mockResolvedValue({
        ...validOtpRecord,
        expiresAt: new Date(Date.now() - 1000),
      });

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.createShipment(fullData, mockUser),
      ).rejects.toMatchObject({ statusCode: 400, message: "OTP expired" });
      expect(mockShipment.create).not.toHaveBeenCalled();
    });

    it("throws 403 when max OTP attempts exceeded", async () => {
      mockVerification.findFirst.mockResolvedValue({
        ...validOtpRecord,
        value: "123456:3",
      });

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.createShipment(fullData, mockUser),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(mockShipment.create).not.toHaveBeenCalled();
    });

    it("throws 404 when category is not found", async () => {
      mockCategory.findUnique.mockResolvedValue(null);

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.createShipment(fullData, mockUser),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Shipment category not found",
      });
    });

    it("throws 400 when weight exceeds maxWeight", async () => {
      mockCategory.findUnique.mockResolvedValue({
        id: "cat-1",
        minPrice: 10,
        maxWeight: 3,
      });

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.createShipment(fullData, mockUser),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Weight exceeds category maximum of 3",
      });
    });

    it("throws 400 when quantity exceeds maxQuantity", async () => {
      mockCategory.findUnique.mockResolvedValue({
        id: "cat-1",
        minPrice: 10,
        maxQuantity: 1,
      });

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.createShipment(fullData, mockUser),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Quantity exceeds category maximum of 1",
      });
    });

    it("throws 400 when pricePerKg is below minPrice", async () => {
      mockCategory.findUnique.mockResolvedValue({
        id: "cat-1",
        minPrice: 200,
      });

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.createShipment(fullData, mockUser),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Price must be at least 200",
      });
    });

    it("throws 400 when pricePerKg exceeds maxPrice", async () => {
      mockCategory.findUnique.mockResolvedValue({
        id: "cat-1",
        minPrice: 10,
        maxPrice: 50,
      });

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.createShipment(fullData, mockUser),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Price must not exceed 50",
      });
    });
  });

  describe("getShipments", () => {
    it("returns user's paginated shipments", async () => {
      mockShipment.findMany.mockResolvedValue([{ id: "ship-1" }]);
      mockShipment.count.mockResolvedValue(1);

      const { ShipmentService } = await importService();
      const result = await ShipmentService.getShipments({}, mockUser);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockShipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
        }),
      );
    });
  });

  describe("getShipmentById", () => {
    it("returns user's shipment", async () => {
      mockShipment.findFirst.mockResolvedValue({ id: "ship-1", userId });

      const { ShipmentService } = await importService();
      const result = await ShipmentService.getShipmentById("ship-1", mockUser);

      expect(result).toEqual({ id: "ship-1", userId });
      expect(mockShipment.findFirst).toHaveBeenCalledWith({
        where: { id: "ship-1", userId },
        include: { category: true },
      });
    });

    it("throws 404 if shipment not found or not owned", async () => {
      mockShipment.findFirst.mockResolvedValue(null);

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.getShipmentById("ship-1", mockUser),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Shipment not found",
      });
    });
  });

  describe("updateShipment", () => {
    it("updates shipment for owner", async () => {
      mockShipment.findUnique.mockResolvedValue({
        id: "ship-1",
        userId,
        categoryId: "cat-1",
        weight: 5,
        quantity: 2,
        pricePerKg: 100,
        itemPhotos: ["https://cdn.shiffto.com/shipments/photos/old.jpg"],
      });
      mockShipment.update.mockResolvedValue({ id: "ship-1", itemName: "New" });

      const { ShipmentService } = await importService();
      const result = await ShipmentService.updateShipment(
        "ship-1",
        { itemName: "New" },
        mockUser,
      );

      expect(result).toEqual({ id: "ship-1", itemName: "New" });
      expect(mockFileUploader.deletePublicFile).not.toHaveBeenCalled();
    });

    it("cleans up orphan photos when itemPhotos is updated", async () => {
      mockShipment.findUnique.mockResolvedValue({
        id: "ship-1",
        userId,
        categoryId: "cat-1",
        weight: 5,
        quantity: 2,
        pricePerKg: 100,
        itemPhotos: [
          "https://cdn.shiffto.com/shipments/photos/keep.jpg",
          "https://cdn.shiffto.com/shipments/photos/remove.jpg",
        ],
      });
      mockShipment.update.mockResolvedValue({
        id: "ship-1",
        itemPhotos: ["https://cdn.shiffto.com/shipments/photos/keep.jpg"],
      });

      const { ShipmentService } = await importService();
      await ShipmentService.updateShipment(
        "ship-1",
        {
          itemPhotos: ["https://cdn.shiffto.com/shipments/photos/keep.jpg"],
        },
        mockUser,
      );

      expect(mockFileUploader.extractKey).toHaveBeenCalledWith(
        "https://cdn.shiffto.com/shipments/photos/remove.jpg",
      );
      expect(mockFileUploader.deletePublicFile).toHaveBeenCalledWith(
        "shipments/photos/remove.jpg",
      );
    });

    it("throws 404 if not owner", async () => {
      mockShipment.findUnique.mockResolvedValue(null);

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.updateShipment("ship-1", { itemName: "X" }, mockUser),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("deleteShipment", () => {
    it("deletes shipment for owner and cleans up photos", async () => {
      mockShipment.findFirst.mockResolvedValue({
        id: "ship-1",
        userId,
        itemPhotos: [
          "https://cdn.shiffto.com/shipments/photos/photo1.jpg",
          "https://cdn.shiffto.com/shipments/photos/photo2.jpg",
        ],
      });
      mockShipment.delete.mockResolvedValue({ id: "ship-1" });

      const { ShipmentService } = await importService();
      const result = await ShipmentService.deleteShipment("ship-1", mockUser);

      expect(result).toEqual({ id: "ship-1" });
      expect(mockFileUploader.deletePublicFile).toHaveBeenCalledTimes(2);
      expect(mockFileUploader.extractKey).toHaveBeenCalledTimes(2);
    });

    it("does not attempt cleanup when shipment has no photos", async () => {
      mockShipment.findFirst.mockResolvedValue({
        id: "ship-1",
        userId,
        itemPhotos: [],
      });
      mockShipment.delete.mockResolvedValue({ id: "ship-1" });

      const { ShipmentService } = await importService();
      await ShipmentService.deleteShipment("ship-1", mockUser);

      expect(mockFileUploader.deletePublicFile).not.toHaveBeenCalled();
    });

    it("throws 404 if not owner", async () => {
      mockShipment.findFirst.mockResolvedValue(null);

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.deleteShipment("ship-1", mockUser),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});

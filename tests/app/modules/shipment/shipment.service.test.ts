import { describe, expect, it, vi, beforeEach } from "vitest";
import ApiError from "../../../src/app/errors/ApiError";

const mockShipment = {
  create: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockCategory = {
  findUnique: vi.fn(),
};

vi.mock("../../../../src/app/lib/prisma", () => ({
  default: {
    shipment: mockShipment,
    shipmentCategory: mockCategory,
  },
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
};

const userId = "user-1";

describe("ShipmentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const importService = () =>
    import("../../../../src/app/modules/shipment/shipment.service");

  describe("createShipment", () => {
    it("creates a shipment when constraints are met", async () => {
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
      const result = await ShipmentService.createShipment(fullData, userId);

      expect(result.id).toBe("ship-1");
      expect(mockShipment.create).toHaveBeenCalledWith({
        data: { ...fullData, userId },
        include: { category: true },
      });
    });

    it("throws 404 when category is not found", async () => {
      mockCategory.findUnique.mockResolvedValue(null);

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.createShipment(fullData, userId),
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
        ShipmentService.createShipment(fullData, userId),
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
        ShipmentService.createShipment(fullData, userId),
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
        ShipmentService.createShipment(fullData, userId),
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
        ShipmentService.createShipment(fullData, userId),
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
      const result = await ShipmentService.getShipments({}, userId);

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
      const result = await ShipmentService.getShipmentById("ship-1", userId);

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
        ShipmentService.getShipmentById("ship-1", userId),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Shipment not found",
      });
    });
  });

  describe("updateShipment", () => {
    it("updates shipment for owner", async () => {
      mockShipment.findFirst.mockResolvedValueOnce({
        id: "ship-1",
        userId,
        categoryId: "cat-1",
        weight: 5,
        quantity: 2,
        pricePerKg: 100,
      });
      mockShipment.update.mockResolvedValue({ id: "ship-1", itemName: "New" });

      const { ShipmentService } = await importService();
      const result = await ShipmentService.updateShipment(
        "ship-1",
        { itemName: "New" },
        userId,
      );

      expect(result).toEqual({ id: "ship-1", itemName: "New" });
    });

    it("throws 404 if not owner", async () => {
      mockShipment.findFirst.mockResolvedValue(null);

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.updateShipment("ship-1", { itemName: "X" }, userId),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("deleteShipment", () => {
    it("deletes shipment for owner", async () => {
      mockShipment.findFirst.mockResolvedValue({ id: "ship-1", userId });
      mockShipment.delete.mockResolvedValue({ id: "ship-1" });

      const { ShipmentService } = await importService();
      const result = await ShipmentService.deleteShipment("ship-1", userId);

      expect(result).toEqual({ id: "ship-1" });
    });

    it("throws 404 if not owner", async () => {
      mockShipment.findFirst.mockResolvedValue(null);

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.deleteShipment("ship-1", userId),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});

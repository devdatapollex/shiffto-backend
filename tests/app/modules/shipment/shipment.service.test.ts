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

const mockStepDefinition = {
  findMany: vi.fn(),
};

const mockShipmentStep = {
  createMany: vi.fn(),
  findMany: vi.fn(),
};

const mockTrip = {
  findUnique: vi.fn(),
};

const mockPrisma = {
  shipment: mockShipment,
  shipmentCategory: mockCategory,
  verification: mockVerification,
  stepDefinition: mockStepDefinition,
  shipmentStep: mockShipmentStep,
  trip: mockTrip,
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

const mockDefinitions = [
  {
    id: "def-1",
    stage: "PAYMENT_CONFIRMED" as const,
    order: 1,
    label: "Payment confirmed",
    description: null,
  },
  {
    id: "def-2",
    stage: "PICKED_UP" as const,
    order: 2,
    label: "Picked up",
    description: null,
  },
  {
    id: "def-3",
    stage: "CHECKED_IN" as const,
    order: 3,
    label: "Checked in",
    description: null,
  },
  {
    id: "def-4",
    stage: "IN_TRANSIT" as const,
    order: 4,
    label: "In transit",
    description: "Flight is on the way to destination",
  },
  {
    id: "def-5",
    stage: "ARRIVED_AT_DESTINATION" as const,
    order: 5,
    label: "Arrived at destination",
    description: null,
  },
  {
    id: "def-6",
    stage: "OUT_FOR_DELIVERY" as const,
    order: 6,
    label: "Out for delivery",
    description: null,
  },
  {
    id: "def-7",
    stage: "DELIVERED" as const,
    order: 7,
    label: "Delivered",
    description: null,
  },
];

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
    mockStepDefinition.findMany.mockResolvedValue(mockDefinitions);
    mockShipmentStep.createMany.mockResolvedValue({ count: 7 });
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
      mockShipment.findUnique.mockResolvedValue({
        id: "ship-1",
        ...fullData,
        userId,
        category: { id: "cat-1", name: "Electronics" },
      });

      const { ShipmentService } = await importService();
      const result = await ShipmentService.createShipment(fullData, mockUser);

      const { otp: _otp, ...shipmentData } = fullData;

      expect(result.id).toBe("ship-1");
      expect(mockShipment.create).toHaveBeenCalledWith({
        data: {
          ...shipmentData,
          itemPhotos: shipmentData.itemPhotos ?? [],
          userId,
        },
      });
      expect(mockStepDefinition.findMany).toHaveBeenCalledWith({
        orderBy: { order: "asc" },
      });
      expect(mockShipmentStep.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            shipmentId: "ship-1",
            definitionId: "def-1",
            stage: "PAYMENT_CONFIRMED",
            order: 1,
            isCurrent: true,
            completedAt: null,
          }),
          expect.objectContaining({
            shipmentId: "ship-1",
            definitionId: "def-2",
            stage: "PICKED_UP",
            order: 2,
            isCurrent: false,
            completedAt: null,
          }),
        ]),
      });
    });

    it("does not include otp in the persisted shipment", async () => {
      mockCategory.findUnique.mockResolvedValue({
        id: "cat-1",
        minPrice: 10,
      });
      mockShipment.create.mockResolvedValue({ id: "ship-1" });
      mockShipment.findUnique.mockResolvedValue({
        id: "ship-1",
        category: { id: "cat-1", name: "Electronics" },
      });

      const { ShipmentService } = await importService();
      await ShipmentService.createShipment(fullData, mockUser);

      const createCall = mockShipment.create.mock.calls[0][0];
      expect(createCall.data).not.toHaveProperty("otp");
      expect(createCall.data).toHaveProperty("categoryId", "cat-1");
    });

    it("consumes the OTP after a successful create", async () => {
      mockCategory.findUnique.mockResolvedValue({ id: "cat-1", minPrice: 10 });
      mockShipment.create.mockResolvedValue({ id: "ship-1" });
      mockShipment.findUnique.mockResolvedValue({
        id: "ship-1",
        category: { id: "cat-1", name: "Electronics" },
      });

      const { ShipmentService } = await importService();
      await ShipmentService.createShipment(fullData, mockUser);

      expect(mockVerification.delete).toHaveBeenCalledWith({
        where: { id: validOtpRecord.id },
      });
    });

    it("throws 400 when fromCountry and toCountry are the same", async () => {
      const sameCountryData = {
        ...fullData,
        fromCountry: "US",
        toCountry: "US",
      };

      const { ShipmentService } = await importService();
      await expect(
        ShipmentService.createShipment(sameCountryData, mockUser),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Origin country and destination country cannot be the same",
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

    it("admin without params returns all shipments (no userId filter)", async () => {
      const adminUser = { ...mockUser, role: "admin" as const };
      mockShipment.findMany.mockResolvedValue([
        { id: "ship-1" },
        { id: "ship-2" },
      ]);
      mockShipment.count.mockResolvedValue(2);

      const { ShipmentService } = await importService();
      const result = await ShipmentService.getShipments({}, adminUser);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(mockShipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it("admin with userId param filters by that user", async () => {
      const adminUser = { ...mockUser, role: "admin" as const };
      mockShipment.findMany.mockResolvedValue([{ id: "ship-1" }]);
      mockShipment.count.mockResolvedValue(1);

      const { ShipmentService } = await importService();
      await ShipmentService.getShipments(
        { userId: "other-user-id" },
        adminUser,
      );

      expect(mockShipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "other-user-id" },
        }),
      );
    });

    it("status param filters by shipment status", async () => {
      mockShipment.findMany.mockResolvedValue([
        { id: "ship-1", status: "active" },
      ]);
      mockShipment.count.mockResolvedValue(1);

      const { ShipmentService } = await importService();
      await ShipmentService.getShipments({ status: "active" }, mockUser);

      expect(mockShipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, status: "active" },
        }),
      );
    });

    it("search param creates OR filter across multiple fields", async () => {
      mockShipment.findMany.mockResolvedValue([{ id: "ship-1" }]);
      mockShipment.count.mockResolvedValue(1);

      const { ShipmentService } = await importService();
      await ShipmentService.getShipments({ search: "laptop" }, mockUser);

      expect(mockShipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            OR: expect.arrayContaining([
              expect.objectContaining({
                itemName: expect.objectContaining({ contains: "laptop" }),
              }),
            ]),
          }),
        }),
      );
    });

    it("sortBy and sortOrder params control ordering", async () => {
      mockShipment.findMany.mockResolvedValue([]);
      mockShipment.count.mockResolvedValue(0);

      const { ShipmentService } = await importService();
      await ShipmentService.getShipments(
        { sortBy: "pricePerKg", sortOrder: "desc" },
        mockUser,
      );

      expect(mockShipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { pricePerKg: "desc" },
        }),
      );
    });

    it("invalid sortBy falls back to itemName with default desc order", async () => {
      mockShipment.findMany.mockResolvedValue([]);
      mockShipment.count.mockResolvedValue(0);

      const { ShipmentService } = await importService();
      await ShipmentService.getShipments({ sortBy: "invalidField" }, mockUser);

      expect(mockShipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { itemName: "desc" },
        }),
      );
    });

    it("non-admin always filters by own userId regardless of query.userId", async () => {
      mockShipment.findMany.mockResolvedValue([]);
      mockShipment.count.mockResolvedValue(0);

      const { ShipmentService } = await importService();
      await ShipmentService.getShipments({ userId: "other-user-id" }, mockUser);

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

    it("throws 400 if updated source and destination are the same", async () => {
      mockShipment.findUnique.mockResolvedValue({
        id: "ship-1",
        userId,
        categoryId: "cat-1",
        weight: 5,
        quantity: 2,
        pricePerKg: 100,
        fromCountry: "US",
        toCountry: "BD",
        itemPhotos: [],
      });

      const { ShipmentService } = await importService();
      await expect(
        ShipmentService.updateShipment(
          "ship-1",
          { fromCountry: "CA", toCountry: "CA" },
          mockUser,
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Origin country and destination country cannot be the same",
      });
    });

    it("throws 400 if updating only fromCountry to be the same as existing toCountry", async () => {
      mockShipment.findUnique.mockResolvedValue({
        id: "ship-1",
        userId,
        categoryId: "cat-1",
        weight: 5,
        quantity: 2,
        pricePerKg: 100,
        fromCountry: "US",
        toCountry: "BD",
        itemPhotos: [],
      });

      const { ShipmentService } = await importService();
      await expect(
        ShipmentService.updateShipment(
          "ship-1",
          { fromCountry: "BD" },
          mockUser,
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Origin country and destination country cannot be the same",
      });
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

  describe("getShipmentDetails", () => {
    it("returns details including category and steps for owner/traveler", async () => {
      mockShipment.findFirst.mockResolvedValue({
        id: "ship-1",
        userId: "user-1",
        tripId: "trip-1",
        itemName: "Laptop",
      });
      mockTrip.findUnique.mockResolvedValue({
        id: "trip-1",
        flightNumber: "TR123",
        fromCountry: "US",
        toCountry: "BD",
        flightDate: new Date(),
        flightTime: "10:00",
        cabinBagCapacity: 10,
        checkInBagCapacity: 20,
        remainingCabinCapacity: 5,
        remainingCheckInCapacity: 15,
        user: {
          id: "traveler-1",
          name: "Bob",
          email: "bob@example.com",
          image: null,
          phone: "123",
        },
      });

      const { ShipmentService } = await importService();
      const result = await ShipmentService.getShipmentDetails(
        "ship-1",
        mockUser,
      );

      expect(result.id).toBe("ship-1");
      expect(result.trip).toEqual(
        expect.objectContaining({
          id: "trip-1",
          flightNumber: "TR123",
          totalCapacity: 30,
          remainingCapacity: 20,
        }),
      );
    });

    it("throws 404 if shipment not found", async () => {
      mockShipment.findFirst.mockResolvedValue(null);
      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.getShipmentDetails("ship-1", mockUser),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("getShipmentSteps", () => {
    it("returns steps for sender or traveler", async () => {
      mockShipment.findUnique.mockResolvedValue({
        id: "ship-1",
        userId: "user-1",
        trip: { userId: "traveler-1" },
      });
      mockShipmentStep.findMany.mockResolvedValue([
        { id: "step-1", stage: "PAYMENT_CONFIRMED", order: 1 },
      ]);

      const { ShipmentService } = await importService();
      const result = await ShipmentService.getShipmentSteps("ship-1", mockUser);

      expect(result).toHaveLength(1);
      expect(result[0].stage).toBe("PAYMENT_CONFIRMED");
    });

    it("throws 403 if unauthorized user requests steps", async () => {
      mockShipment.findUnique.mockResolvedValue({
        id: "ship-1",
        userId: "user-1",
        trip: { userId: "traveler-1" },
      });

      const unauthorizedUser = {
        id: "hacker-1",
        email: "hacker@example.com",
        role: "user" as const,
      };

      const { ShipmentService } = await importService();

      await expect(
        ShipmentService.getShipmentSteps("ship-1", unauthorizedUser),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });
});

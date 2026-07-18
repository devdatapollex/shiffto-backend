import { describe, expect, it, vi, beforeEach } from "vitest";
import ApiError from "../../../../src/app/errors/ApiError";
import {
  OfferStatus,
  ShipmentStatus,
} from "../../../../src/generated/prisma/enums";

// Mock prisma client
const mockOffer = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};

const mockShipment = {
  findUnique: vi.fn(),
  update: vi.fn(),
};

const mockTrip = {
  findUnique: vi.fn(),
  update: vi.fn(),
};

const mockNotification = {
  create: vi.fn(),
};

const mockPrisma = {
  offer: mockOffer,
  shipment: mockShipment,
  trip: mockTrip,
  notification: mockNotification,
  $transaction: vi.fn((cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
    cb(mockPrisma),
  ),
};

vi.mock("../../../../src/app/lib/prisma", () => ({
  default: mockPrisma,
}));

// Mock ShipmentStepService
const mockShipmentStepService = {
  confirmPayment: vi.fn(),
};

vi.mock("../../../../src/app/modules/shipment/shipment-step.service", () => ({
  ShipmentStepService: mockShipmentStepService,
}));

describe("OfferService", () => {
  const mockUser = {
    id: "user-1",
    email: "traveller@example.com",
    role: "user" as const,
  };

  const mockShipmentData = {
    id: "shipment-1",
    itemName: "iPhone 15",
    weight: 1.5,
    quantity: 1,
    fromCountry: "US",
    toCountry: "BD",
    pricePerKg: 50,
    status: ShipmentStatus.AWAITING_MATCH,
    tripId: null,
    userId: "sender-1",
    category: {
      id: "cat-1",
      name: "Electronics",
      minPrice: 30,
      maxPrice: 100,
    },
  };

  const mockTripData = {
    id: "trip-1",
    status: "ACTIVE",
    userId: "user-1",
    fromCountry: "US",
    toCountry: "BD",
    cabinBagCapacity: 5,
    checkInBagCapacity: 20,
    remainingCabinCapacity: 3,
    remainingCheckInCapacity: 15,
  };

  const importService = () =>
    import("../../../../src/app/modules/offer/offer.service");

  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
  });

  describe("createOffer", () => {
    it("should create offer successfully", async () => {
      mockShipment.findUnique.mockResolvedValue(mockShipmentData);
      mockTrip.findUnique.mockResolvedValue(mockTripData);
      mockOffer.findFirst.mockResolvedValue(null);
      mockOffer.create.mockResolvedValue({ id: "offer-1" });

      const payload = {
        shipmentId: "shipment-1",
        tripId: "trip-1",
        offeredPrice: 45,
        bagType: "checkIn" as const,
      };

      const { OfferService } = await importService();
      const result = await OfferService.createOffer(payload, mockUser as any);
      expect(result).toBeDefined();
      expect(mockOffer.create).toHaveBeenCalledWith({
        data: {
          shipmentId: "shipment-1",
          travellerId: "user-1",
          tripId: "trip-1",
          senderPrice: 50,
          offeredPrice: 45,
          bagType: "checkIn",
          isCounterOffer: true,
          status: OfferStatus.PENDING,
        },
        include: {
          shipment: {
            include: { category: true },
          },
          trip: true,
        },
      });
    });

    it("should throw error if shipment not found", async () => {
      mockShipment.findUnique.mockResolvedValue(null);

      const payload = {
        shipmentId: "shipment-1",
        tripId: "trip-1",
        offeredPrice: 45,
        bagType: "checkIn" as const,
      };

      const { OfferService } = await importService();
      await expect(
        OfferService.createOffer(payload, mockUser as any),
      ).rejects.toThrow(new ApiError(404, "Shipment not found"));
    });

    it("should throw error if trip is not active", async () => {
      mockShipment.findUnique.mockResolvedValue(mockShipmentData);
      mockTrip.findUnique.mockResolvedValue({
        ...mockTripData,
        status: "PENDING",
      });

      const payload = {
        shipmentId: "shipment-1",
        tripId: "trip-1",
        offeredPrice: 45,
        bagType: "checkIn" as const,
      };

      const { OfferService } = await importService();
      await expect(
        OfferService.createOffer(payload, mockUser as any),
      ).rejects.toThrow(new ApiError(400, "Trip is not active"));
    });

    it("should throw error if offeredPrice is below category minPrice", async () => {
      mockShipment.findUnique.mockResolvedValue(mockShipmentData);
      mockTrip.findUnique.mockResolvedValue(mockTripData);

      const payload = {
        shipmentId: "shipment-1",
        tripId: "trip-1",
        offeredPrice: 20, // min is 30
        bagType: "checkIn" as const,
      };

      const { OfferService } = await importService();
      await expect(
        OfferService.createOffer(payload, mockUser as any),
      ).rejects.toThrow(
        new ApiError(
          400,
          "Offered price cannot be lower than the category minimum of $30",
        ),
      );
    });

    it("should throw error if insufficient capacity", async () => {
      mockShipment.findUnique.mockResolvedValue(mockShipmentData);
      mockTrip.findUnique.mockResolvedValue({
        ...mockTripData,
        remainingCheckInCapacity: 1.0, // weight is 1.5
      });

      const payload = {
        shipmentId: "shipment-1",
        tripId: "trip-1",
        offeredPrice: 45,
        bagType: "checkIn" as const,
      };

      const { OfferService } = await importService();
      await expect(
        OfferService.createOffer(payload, mockUser as any),
      ).rejects.toThrow(
        new ApiError(
          400,
          "Insufficient check-in bag capacity. Needed: 1.5kg, Available: 1kg",
        ),
      );
    });
  });

  describe("acceptOffer", () => {
    const mockOfferData = {
      id: "offer-1",
      shipmentId: "shipment-1",
      travellerId: "user-1",
      tripId: "trip-1",
      offeredPrice: 45,
      bagType: "checkIn" as const,
      status: OfferStatus.PENDING,
      shipment: {
        id: "shipment-1",
        userId: "sender-1",
        weight: 1.5,
        itemName: "iPhone 15",
        shipmentSteps: [
          {
            id: "step-1",
            stage: "PAYMENT_CONFIRMED",
            order: 1,
            completedAt: null,
          },
          { id: "step-2", stage: "PICKED_UP", order: 2, isCurrent: false },
        ],
      },
      trip: {
        id: "trip-1",
        status: "ACTIVE",
        remainingCheckInCapacity: 15,
      },
    };

    const mockSenderUser = {
      id: "sender-1",
      email: "sender@example.com",
      role: "user" as const,
    };

    it("should accept offer and deduct capacity inside transaction", async () => {
      mockOffer.findUnique.mockResolvedValueOnce(mockOfferData);
      mockTrip.findUnique.mockResolvedValue(mockOfferData.trip);
      mockOffer.update.mockResolvedValue({
        ...mockOfferData,
        status: OfferStatus.ACCEPTED,
      });
      mockOffer.findUnique.mockResolvedValueOnce({
        ...mockOfferData,
        status: OfferStatus.ACCEPTED,
      });
      mockShipmentStepService.confirmPayment.mockResolvedValue([]);

      const { OfferService } = await importService();
      const result = await OfferService.acceptOffer(
        "offer-1",
        mockSenderUser as any,
      );
      expect(result).toBeDefined();

      expect(mockTrip.update).toHaveBeenCalledWith({
        where: { id: "trip-1" },
        data: { remainingCheckInCapacity: { decrement: 1.5 } },
      });

      expect(mockOffer.updateMany).toHaveBeenCalledWith({
        where: {
          shipmentId: "shipment-1",
          id: { not: "offer-1" },
          status: OfferStatus.PENDING,
        },
        data: { status: OfferStatus.REJECTED },
      });

      expect(mockShipment.update).toHaveBeenCalledWith({
        where: { id: "shipment-1" },
        data: {
          tripId: "trip-1",
          bagType: "checkIn",
          pricePerKg: 45,
        },
      });

      expect(mockNotification.create).toHaveBeenCalled();
      expect(mockShipmentStepService.confirmPayment).toHaveBeenCalledWith(
        "shipment-1",
        mockSenderUser,
        mockPrisma,
      );
    });

    it("should throw error if non-owner tries to accept", async () => {
      mockOffer.findUnique.mockResolvedValue(mockOfferData);

      const wrongUser = { id: "wrong-user", role: "user" };

      const { OfferService } = await importService();
      await expect(
        OfferService.acceptOffer("offer-1", wrongUser as any),
      ).rejects.toThrow(
        new ApiError(403, "Only the shipment owner can accept offers"),
      );
    });
  });

  describe("rejectOffer", () => {
    const mockOfferData = {
      id: "offer-1",
      shipmentId: "shipment-1",
      travellerId: "user-1",
      tripId: "trip-1",
      offeredPrice: 45,
      bagType: "checkIn" as const,
      status: OfferStatus.PENDING,
      shipment: {
        id: "shipment-1",
        userId: "sender-1",
        itemName: "iPhone 15",
      },
    };

    const mockSenderUser = {
      id: "sender-1",
      email: "sender@example.com",
      role: "user" as const,
    };

    it("should reject offer and update status", async () => {
      mockOffer.findUnique.mockResolvedValue(mockOfferData);
      mockOffer.update.mockResolvedValue({
        ...mockOfferData,
        status: OfferStatus.REJECTED,
      });

      const { OfferService } = await importService();
      const result = await OfferService.rejectOffer(
        "offer-1",
        mockSenderUser as any,
      );
      expect(result).toBeDefined();

      expect(mockOffer.update).toHaveBeenCalledWith({
        where: { id: "offer-1" },
        data: { status: OfferStatus.REJECTED },
      });
      expect(mockNotification.create).toHaveBeenCalled();
    });
  });
});

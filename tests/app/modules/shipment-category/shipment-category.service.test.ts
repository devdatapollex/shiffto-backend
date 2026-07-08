import { describe, expect, it, vi, beforeEach } from "vitest";
import ApiError from "../../../src/app/errors/ApiError";

const mockCategory = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../../../../src/app/lib/prisma", () => ({
  default: {
    shipmentCategory: mockCategory,
  },
}));

describe("ShipmentCategoryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const importService = () =>
    import("../../../../src/app/modules/shipment-category/shipment-category.service");

  describe("getCategoryById", () => {
    it("returns category when found", async () => {
      const category = { id: "cat-1", name: "Small", slug: "small" };
      mockCategory.findUnique.mockResolvedValue(category);

      const { ShipmentCategoryService } = await importService();
      const result = await ShipmentCategoryService.getCategoryById("cat-1");

      expect(result).toEqual(category);
      expect(mockCategory.findUnique).toHaveBeenCalledWith({
        where: { id: "cat-1" },
      });
    });

    it("throws 404 when category not found", async () => {
      mockCategory.findUnique.mockResolvedValue(null);

      const { ShipmentCategoryService } = await importService();

      await expect(
        ShipmentCategoryService.getCategoryById("missing"),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Shipment category not found",
      });
    });
  });

  describe("createCategory", () => {
    it("creates a category with provided data", async () => {
      const data = { name: "Large", slug: "large", minPrice: 50 };
      const created = { id: "cat-2", ...data };
      mockCategory.create.mockResolvedValue(created);

      const { ShipmentCategoryService } = await importService();
      const result = await ShipmentCategoryService.createCategory(data);

      expect(result).toEqual(created);
      expect(mockCategory.create).toHaveBeenCalledWith({ data });
    });
  });

  describe("getCategories", () => {
    it("returns paginated categories", async () => {
      const categories = [{ id: "cat-1" }, { id: "cat-2" }];
      mockCategory.findMany.mockResolvedValue(categories);
      mockCategory.count.mockResolvedValue(2);

      const { ShipmentCategoryService } = await importService();
      const result = await ShipmentCategoryService.getCategories({});

      expect(result.data).toEqual(categories);
      expect(result.meta.total).toBe(2);
    });
  });

  describe("updateCategory", () => {
    it("updates a category when it exists", async () => {
      const existing = { id: "cat-1", name: "Old" };
      const updated = { id: "cat-1", name: "New" };
      mockCategory.findUnique.mockResolvedValue(existing);
      mockCategory.update.mockResolvedValue(updated);

      const { ShipmentCategoryService } = await importService();
      const result = await ShipmentCategoryService.updateCategory("cat-1", {
        name: "New",
      });

      expect(result).toEqual(updated);
    });

    it("throws 404 if category does not exist", async () => {
      mockCategory.findUnique.mockResolvedValue(null);

      const { ShipmentCategoryService } = await importService();

      await expect(
        ShipmentCategoryService.updateCategory("missing", { name: "X" }),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("deleteCategory", () => {
    it("deletes a category when it exists", async () => {
      mockCategory.findUnique.mockResolvedValue({ id: "cat-1" });
      mockCategory.delete.mockResolvedValue({ id: "cat-1" });

      const { ShipmentCategoryService } = await importService();
      const result = await ShipmentCategoryService.deleteCategory("cat-1");

      expect(result).toEqual({ id: "cat-1" });
    });

    it("throws 404 if category does not exist", async () => {
      mockCategory.findUnique.mockResolvedValue(null);

      const { ShipmentCategoryService } = await importService();

      await expect(
        ShipmentCategoryService.deleteCategory("missing"),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});

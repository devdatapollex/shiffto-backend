import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/app/lib/storage", () => ({
  uploadToPublicBucket: vi.fn((key: string) =>
    Promise.resolve({ key, url: `https://cdn.shiffto.com/${key}` }),
  ),
  uploadToPrivateBucket: vi.fn((key: string) =>
    Promise.resolve({ key, downloadUrl: `https://presigned.url/${key}` }),
  ),
  getPresignedUrl: vi.fn(() => Promise.resolve("https://presigned.url/file")),
  deleteObject: vi.fn(() => Promise.resolve()),
}));

const { fileUploader } = await import("../../../src/app/helper/fileUploader");
const storage = await import("../../../src/app/lib/storage");

describe("fileUploader", () => {
  const mockFile = {
    buffer: Buffer.from("image-data"),
    originalname: "photo.jpg",
    mimetype: "image/jpeg",
  } as Express.Multer.File;

  it("uploads a file to the public bucket", async () => {
    const result = await fileUploader.uploadPublic(mockFile, "products");

    expect(storage.uploadToPublicBucket).toHaveBeenCalledWith(
      expect.stringContaining("products/"),
      mockFile.buffer,
      "image/jpeg",
    );
    expect(result.key).toEqual(expect.stringContaining("products/"));
    expect(result.key).toEqual(expect.stringContaining(".jpg"));
    expect(result.url).toBeDefined();
  });

  it("uploads a file to the private bucket and returns a presigned URL", async () => {
    const result = await fileUploader.uploadPrivate(mockFile, "invoices");

    expect(storage.uploadToPrivateBucket).toHaveBeenCalledWith(
      expect.stringContaining("invoices/"),
      mockFile.buffer,
      "image/jpeg",
    );
    expect(result.key).toEqual(expect.stringContaining("invoices/"));
    expect(result.downloadUrl).toBeDefined();
  });

  it("generates a presigned URL for a private file", async () => {
    const url = await fileUploader.getPrivateUrl("invoices/photo.jpg");

    expect(storage.getPresignedUrl).toHaveBeenCalledWith(
      "invoices/photo.jpg",
      undefined,
    );
    expect(url).toBeDefined();
  });

  it("deletes a private file from R2", async () => {
    await fileUploader.deleteFile("invoices/photo.jpg");

    expect(storage.deleteObject).toHaveBeenCalledWith("invoices/photo.jpg");
  });
});

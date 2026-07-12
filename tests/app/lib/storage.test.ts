import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("R2_PUBLIC_URL", "https://cdn.shiffto.com");

const mockSend = vi.hoisted(() => vi.fn(() => Promise.resolve({})));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = mockSend;
  },
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(() =>
    Promise.resolve("https://presigned.url/test-file.jpg"),
  ),
}));

const {
  uploadToPublicBucket,
  uploadToPrivateBucket,
  getPresignedUrl,
  deleteObject,
} = await import("../../../src/app/lib/storage");

describe("R2 storage adapter", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a buffer to the public bucket and returns a public URL", async () => {
    const result = await uploadToPublicBucket(
      "products/123.jpg",
      Buffer.from("image-data"),
      "image/jpeg",
    );

    expect(result.key).toBe("products/123.jpg");
    expect(result.url).toBe("https://cdn.shiffto.com/products/123.jpg");
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("uploads a buffer to the private bucket and returns key + presigned URL", async () => {
    const result = await uploadToPrivateBucket(
      "invoices/456.pdf",
      Buffer.from("pdf-data"),
      "application/pdf",
    );

    expect(result.key).toBe("invoices/456.pdf");
    expect(result.downloadUrl).toBe("https://presigned.url/test-file.jpg");
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("generates a presigned URL for an existing private object", async () => {
    const url = await getPresignedUrl("invoices/456.pdf");

    expect(url).toBe("https://presigned.url/test-file.jpg");
  });

  it("deletes an object from R2", async () => {
    await expect(deleteObject("invoices/456.pdf")).resolves.toBeUndefined();
    expect(mockSend).toHaveBeenCalledOnce();
  });
});

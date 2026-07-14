import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../src/app/helper/fileUploader", () => ({
  fileUploader: {
    upload: {},
    uploadPublic: vi.fn((file: Express.Multer.File, folder: string) =>
      Promise.resolve({
        key: `${folder}/${Date.now()}-${file.originalname}`,
        url: `https://cdn.shiffto.com/${folder}/${Date.now()}-${file.originalname}`,
      }),
    ),
  },
}));

const { fileUploader } =
  await import("../../../../src/app/helper/fileUploader");
const { UploadService } =
  await import("../../../../src/app/modules/upload/upload.service");

const makeFile = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File =>
  ({
    buffer: Buffer.from("image-data"),
    originalname: "photo.jpg",
    mimetype: "image/jpeg",
    size: 1024,
    ...overrides,
  }) as Express.Multer.File;

describe("UploadService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadPhotos", () => {
    it("uploads multiple valid files and returns key/url pairs", async () => {
      const files = [
        makeFile(),
        makeFile({ originalname: "photo2.png", mimetype: "image/png" }),
      ];

      const results = await UploadService.uploadPhotos(files);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty("key");
      expect(results[0]).toHaveProperty("url");
      expect(fileUploader.uploadPublic).toHaveBeenCalledTimes(2);
      expect(fileUploader.uploadPublic).toHaveBeenCalledWith(
        files[0],
        "shipments/photos",
      );
    });

    it("throws 400 for invalid file types", async () => {
      const files = [
        makeFile({
          originalname: "doc.docx",
          mimetype:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      ];

      await expect(UploadService.uploadPhotos(files)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("Invalid file type"),
      });
      expect(fileUploader.uploadPublic).not.toHaveBeenCalled();
    });

    it("throws 400 for files exceeding 5MB", async () => {
      const files = [makeFile({ size: 6 * 1024 * 1024 })];

      await expect(UploadService.uploadPhotos(files)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("File too large"),
      });
      expect(fileUploader.uploadPublic).not.toHaveBeenCalled();
    });

    it("rejects all files if any are invalid", async () => {
      const files = [
        makeFile(),
        makeFile({
          originalname: "bad.exe",
          mimetype: "application/x-msdownload",
        }),
      ];

      await expect(UploadService.uploadPhotos(files)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(fileUploader.uploadPublic).not.toHaveBeenCalled();
    });

    it("accepts webp files", async () => {
      const files = [
        makeFile({ originalname: "photo.webp", mimetype: "image/webp" }),
      ];

      await UploadService.uploadPhotos(files);

      expect(fileUploader.uploadPublic).toHaveBeenCalledTimes(1);
    });
  });
});

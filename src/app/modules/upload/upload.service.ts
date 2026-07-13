import { fileUploader } from "../../helper/fileUploader";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";
import { PHOTO_UPLOAD } from "./upload.validation";

const uploadPhotos = async (files: Express.Multer.File[]) => {
  for (const file of files) {
    if (!PHOTO_UPLOAD.ALLOWED_TYPES.includes(file.mimetype)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Invalid file type: ${file.originalname}. Allowed: jpg, jpeg, png, webp, pdf`,
      );
    }
    if (file.size > PHOTO_UPLOAD.MAX_SIZE) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `File too large: ${file.originalname}. Max 5MB`,
      );
    }
  }

  const results = await Promise.all(
    files.map((file) => fileUploader.uploadPublic(file, PHOTO_UPLOAD.FOLDER)),
  );

  return results;
};

export const UploadService = { uploadPhotos };

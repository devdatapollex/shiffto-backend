import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { UploadService } from "./upload.service";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";

const uploadPhotos = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;

  if (!files || files.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No files uploaded");
  }

  const results = await UploadService.uploadPhotos(files);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Photos uploaded successfully",
    data: results,
  });
});

export const UploadController = { uploadPhotos };

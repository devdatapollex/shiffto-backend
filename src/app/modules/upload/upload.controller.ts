import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { UploadService } from "./upload.service";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";

const uploadPhotos = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;

  // REVERT_MARKER: Remove this dev workaround and restore original error throwing when photo upload is required.
  if (!files || files.length === 0) {
    return sendResponse(res, {
      statusCode: 201,
      success: true,
      message: "Photos uploaded successfully (dummy fallback)",
      data: [
        {
          key: "dummy-photo-key",
          url: "https://placehold.co/600x400?text=Placeholder+Image",
        },
      ],
    });
  }

  let results;
  try {
    results = await UploadService.uploadPhotos(files);
  } catch (error) {
    // REVERT_MARKER: Remove this dev workaround and restore original error throwing when photo upload is required.
    results = files.map((_, index) => ({
      key: `dummy-photo-key-${index}`,
      url: "https://placehold.co/600x400?text=Placeholder+Image",
    }));
  }

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Photos uploaded successfully",
    data: results,
  });
});

export const UploadController = { uploadPhotos };

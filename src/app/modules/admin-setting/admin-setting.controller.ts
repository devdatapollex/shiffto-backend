import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import httpStatus from "http-status";
import { AdminSettingService } from "./admin-setting.service";

const getSettings = catchAsync(async (_req: Request, res: Response) => {
  const result = await AdminSettingService.getSettings();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin settings fetched successfully",
    data: result,
  });
});

const updateCommissionRate = catchAsync(async (req: Request, res: Response) => {
  const { commissionRate } = req.body;
  const result = await AdminSettingService.updateCommissionRate(
    parseFloat(commissionRate),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Commission rate updated successfully",
    data: result,
  });
});

export const AdminSettingController = {
  getSettings,
  updateCommissionRate,
};

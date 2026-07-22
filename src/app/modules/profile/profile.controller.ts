import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { ProfileService } from "./profile.service";
import httpStatus from "http-status";

const getProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await ProfileService.getProfile(req.user!.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile fetched successfully",
    data: result,
  });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await ProfileService.updateProfile(req.user!.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  await ProfileService.changePassword(req.headers, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed successfully",
    data: null,
  });
});

const submitKyc = catchAsync(async (req: Request, res: Response) => {
  const result = await ProfileService.submitKyc(req.user!.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "KYC verification submitted successfully",
    data: result,
  });
});

const deactivateAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await ProfileService.deactivateAccount(req.user!.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Account deactivated successfully",
    data: result,
  });
});

const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await ProfileService.deleteAccount(req.user!.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Account deleted permanently",
    data: result,
  });
});

const getAnalytics = catchAsync(async (req: Request, res: Response) => {
  const result = await ProfileService.getAnalytics(req.user!.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User analytics fetched successfully",
    data: result,
  });
});

const getRevenueChart = catchAsync(async (req: Request, res: Response) => {
  const result = await ProfileService.getRevenueChart(
    req.user!.id,
    req.query as any,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Revenue chart data fetched successfully",
    data: result,
  });
});

const getShipmentChart = catchAsync(async (req: Request, res: Response) => {
  const result = await ProfileService.getShipmentChart(
    req.user!.id,
    req.query.year as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shipment chart data fetched successfully",
    data: result,
  });
});

export const ProfileController = {
  getProfile,
  updateProfile,
  changePassword,
  submitKyc,
  deactivateAccount,
  deleteAccount,
  getAnalytics,
  getRevenueChart,
  getShipmentChart,
};

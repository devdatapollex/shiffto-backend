import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { AdminService } from "./admin.service";
import httpStatus from "http-status";

const getKycSubmissions = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getKycSubmissions(
    req.query as Record<string, unknown>,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "KYC submissions fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const reviewKyc = catchAsync(async (req: Request, res: Response) => {
  const { status, rejectionReason } = req.body;
  const result = await AdminService.reviewKyc(
    req.params.id as string,
    status,
    rejectionReason,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `KYC submission ${status.toLowerCase()} successfully`,
    data: result,
  });
});

const reactivateUser = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.reactivateUser(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User account reactivated successfully",
    data: result,
  });
});

const getAdminAnalytics = catchAsync(async (_req: Request, res: Response) => {
  const result = await AdminService.getAdminAnalytics();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin analytics fetched successfully",
    data: result,
  });
});

export const AdminController = {
  getKycSubmissions,
  reviewKyc,
  reactivateUser,
  getAdminAnalytics,
};

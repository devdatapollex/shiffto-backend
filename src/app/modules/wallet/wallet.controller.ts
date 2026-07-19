import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import httpStatus from "http-status";
import { WalletService } from "./wallet.service";

const getMyPaymentMethods = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const result = await WalletService.getUserPaymentMethods(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment methods fetched successfully",
    data: result,
  });
});

const addPaymentMethod = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const result = await WalletService.addPaymentMethod(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Payment method added successfully",
    data: result,
  });
});

const updatePaymentMethod = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const id = req.params.id as string;
  const result = await WalletService.updatePaymentMethod(user.id, id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment method updated successfully",
    data: result,
  });
});

const deletePaymentMethod = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const id = req.params.id as string;
  const result = await WalletService.deletePaymentMethod(user.id, id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment method deleted successfully",
    data: result,
  });
});

const setPrimaryPaymentMethod = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user!;
    const id = req.params.id as string;
    const result = await WalletService.setPrimaryPaymentMethod(user.id, id);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Primary payment method set successfully",
      data: result,
    });
  },
);

export const WalletController = {
  getMyPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  setPrimaryPaymentMethod,
};

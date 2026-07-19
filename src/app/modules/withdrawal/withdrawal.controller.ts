import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import httpStatus from "http-status";
import { WithdrawalService } from "./withdrawal.service";
import { WithdrawalStatus } from "../../../generated/prisma/enums";

const requestWithdrawal = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const result = await WithdrawalService.requestWithdrawal(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Withdrawal request submitted successfully",
    data: result,
  });
});

const getMyWithdrawals = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const result = await WithdrawalService.getTravelerWithdrawals(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Withdrawal history fetched successfully",
    data: result,
  });
});

const getAllWithdrawals = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const { status } = req.query;
  const result = await WithdrawalService.getAllWithdrawals(
    user,
    status as WithdrawalStatus | undefined,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin withdrawals fetched successfully",
    data: result,
  });
});

const approveWithdrawal = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const id = req.params.id as string;
  const { payoutTxnId } = req.body;
  const result = await WithdrawalService.approveWithdrawal(
    id,
    payoutTxnId,
    user,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Withdrawal request approved successfully",
    data: result,
  });
});

const rejectWithdrawal = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const id = req.params.id as string;
  const { rejectionReason } = req.body;
  const result = await WithdrawalService.rejectWithdrawal(
    id,
    rejectionReason,
    user,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Withdrawal request rejected successfully",
    data: result,
  });
});

export const WithdrawalController = {
  requestWithdrawal,
  getMyWithdrawals,
  getAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
};

import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { AdminUserService } from "./admin-user.service";

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, search, status } = req.query;

  const result = await AdminUserService.getAllUsers({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    search: search as string,
    status: status as string,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Users retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getUserDetail = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminUserService.getUserDetail(req.params.id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User detail retrieved successfully",
    data: result,
  });
});

const updateUser = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminUserService.updateUser(
    req.params.id as string,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User updated successfully",
    data: result,
  });
});

const bulkActionUsers = catchAsync(async (req: Request, res: Response) => {
  const { userIds, action } = req.body;

  const result = await AdminUserService.bulkActionUsers(userIds, action);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Bulk action executed successfully",
    data: result,
  });
});

export const AdminUserController = {
  getAllUsers,
  getUserDetail,
  updateUser,
  bulkActionUsers,
};

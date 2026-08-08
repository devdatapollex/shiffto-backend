import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { RestrictedItemService } from "./restricted-item.service";

const createItem = catchAsync(async (req: Request, res: Response) => {
  const result = await RestrictedItemService.createItem(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Restricted item created successfully",
    data: result,
  });
});

const getItems = catchAsync(async (req: Request, res: Response) => {
  const result = await RestrictedItemService.getItems(
    req.query as Record<string, unknown>,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Restricted items fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getItemById = catchAsync(async (req: Request, res: Response) => {
  const result = await RestrictedItemService.getItemById(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Restricted item fetched successfully",
    data: result,
  });
});

const updateItem = catchAsync(async (req: Request, res: Response) => {
  const result = await RestrictedItemService.updateItem(
    req.params.id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Restricted item updated successfully",
    data: result,
  });
});

const deleteItem = catchAsync(async (req: Request, res: Response) => {
  const result = await RestrictedItemService.deleteItem(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Restricted item deleted successfully",
    data: result,
  });
});

export const RestrictedItemController = {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem,
};

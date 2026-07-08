import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { ShipmentService } from "./shipment.service";

const createShipment = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentService.createShipment(req.body, req.user!.id);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Shipment created successfully",
    data: result,
  });
});

const getShipments = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentService.getShipments(
    req.query as Record<string, unknown>,
    req.user!.id,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shipments fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getShipmentById = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentService.getShipmentById(
    req.params.id as string,
    req.user!.id,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shipment fetched successfully",
    data: result,
  });
});

const updateShipment = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentService.updateShipment(
    req.params.id as string,
    req.body,
    req.user!.id,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shipment updated successfully",
    data: result,
  });
});

const deleteShipment = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentService.deleteShipment(
    req.params.id as string,
    req.user!.id,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shipment deleted successfully",
    data: result,
  });
});

export const ShipmentController = {
  createShipment,
  getShipments,
  getShipmentById,
  updateShipment,
  deleteShipment,
};

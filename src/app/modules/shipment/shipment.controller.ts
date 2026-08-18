import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { ShipmentService } from "./shipment.service";
import { ShipmentOtpService } from "./shipment-otp.service";

const createShipment = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentService.createShipment(req.body, req.user!);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Shipment created successfully",
    data: result,
  });
});

const sendShipmentOtp = catchAsync(async (req: Request, res: Response) => {
  const otp = await ShipmentOtpService.generateAndSendShipmentOtp(
    req.user!.email,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Verification code sent to your email (OTP: ${otp})`,
    data: { otp },
  });
});

const getShipments = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentService.getShipments(
    req.query as Record<string, unknown>,
    req.user!,
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
    req.user!,
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
    req.user!,
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
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shipment deleted successfully",
    data: result,
  });
});

const getShipmentDetails = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentService.getShipmentDetails(
    req.params.id as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shipment details fetched successfully",
    data: result,
  });
});

const getShipmentSteps = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentService.getShipmentSteps(
    req.params.id as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shipment steps fetched successfully",
    data: result,
  });
});

const cancelShipment = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentService.cancelShipment(
    req.params.id as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shipment canceled successfully",
    data: result,
  });
});

export const ShipmentController = {
  createShipment,
  sendShipmentOtp,
  getShipments,
  getShipmentById,
  getShipmentDetails,
  updateShipment,
  deleteShipment,
  getShipmentSteps,
  cancelShipment,
};

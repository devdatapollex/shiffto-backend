import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { ShipmentMessageService } from "./shipment-message.service";

const getShipmentMessages = catchAsync(async (req: Request, res: Response) => {
  const { shipmentId } = req.params;
  const result = await ShipmentMessageService.getShipmentMessages(
    shipmentId as string,
    req.user!.id,
    req.user!.role,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shipment messages fetched successfully",
    data: result,
  });
});

const sendShipmentMessage = catchAsync(async (req: Request, res: Response) => {
  const { shipmentId } = req.params;
  const result = await ShipmentMessageService.sendShipmentMessage(
    shipmentId as string,
    req.user!.id,
    req.user!.role,
    req.body,
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Message sent successfully",
    data: result,
  });
});

const markMessagesAsRead = catchAsync(async (req: Request, res: Response) => {
  const { shipmentId } = req.params;
  const result = await ShipmentMessageService.markMessagesAsRead(
    shipmentId as string,
    req.user!.id,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Messages marked as read",
    data: result,
  });
});

export const ShipmentMessageController = {
  getShipmentMessages,
  sendShipmentMessage,
  markMessagesAsRead,
};

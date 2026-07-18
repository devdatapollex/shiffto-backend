import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { ShipmentStepService } from "./shipment-step.service";
import { ShipmentOtpService } from "./shipment-otp.service";

const confirmPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentStepService.confirmPayment(
    req.params.id as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payment confirmed successfully",
    data: result,
  });
});

const sendDeliveryOtp = catchAsync(async (req: Request, res: Response) => {
  await ShipmentOtpService.generateDeliveryOtp(req.params.id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Delivery verification code sent to shipment owner",
    data: null,
  });
});

const confirmPickup = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentStepService.confirmPickup(
    req.params.id as string,
    req.user!,
    { photoUrl: req.body.photoUrl, notes: req.body.notes },
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Pickup confirmed successfully",
    data: result,
  });
});

const confirmCheckin = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentStepService.confirmCheckin(
    req.params.id as string,
    req.user!,
    { notes: req.body.notes },
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Check-in confirmed successfully",
    data: result,
  });
});

const confirmTransit = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentStepService.confirmTransit(
    req.params.id as string,
    req.user!,
    { notes: req.body.notes },
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Transit confirmed successfully",
    data: result,
  });
});

const confirmArrival = catchAsync(async (req: Request, res: Response) => {
  const result = await ShipmentStepService.confirmArrival(
    req.params.id as string,
    req.user!,
    { notes: req.body.notes },
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Arrival confirmed successfully",
    data: result,
  });
});

const confirmOutForDelivery = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ShipmentStepService.confirmOutForDelivery(
      req.params.id as string,
      req.user!,
      { notes: req.body.notes },
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Out for delivery confirmed successfully",
      data: result,
    });
  },
);

const confirmDelivery = catchAsync(async (req: Request, res: Response) => {
  const { photoUrl, notes } = req.body;

  const result = await ShipmentStepService.confirmDelivery(
    req.params.id as string,
    req.user!,
    { photoUrl, notes },
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Delivery confirmed successfully",
    data: result,
  });
});

export const ShipmentStepController = {
  confirmPayment,
  sendDeliveryOtp,
  confirmPickup,
  confirmCheckin,
  confirmTransit,
  confirmArrival,
  confirmOutForDelivery,
  confirmDelivery,
};

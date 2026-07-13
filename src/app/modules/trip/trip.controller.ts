import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { TripService } from "./trip.service";

const createTrip = catchAsync(async (req: Request, res: Response) => {
  const result = await TripService.createTrip(req.body, req.user!);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Trip created successfully",
    data: result,
  });
});

const getTrips = catchAsync(async (req: Request, res: Response) => {
  const result = await TripService.getTrips(
    req.query as Record<string, unknown>,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trips fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getTripById = catchAsync(async (req: Request, res: Response) => {
  const result = await TripService.getTripById(
    req.params.id as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trip fetched successfully",
    data: result,
  });
});

const updateTrip = catchAsync(async (req: Request, res: Response) => {
  const result = await TripService.updateTrip(
    req.params.id as string,
    req.body,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trip updated successfully",
    data: result,
  });
});

const cancelTrip = catchAsync(async (req: Request, res: Response) => {
  const result = await TripService.cancelTrip(
    req.params.id as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trip cancelled successfully",
    data: result,
  });
});

const verifyTrip = catchAsync(async (req: Request, res: Response) => {
  const result = await TripService.verifyTrip(
    req.params.id as string,
    req.body,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trip verification updated successfully",
    data: result,
  });
});

const acceptShipment = catchAsync(async (req: Request, res: Response) => {
  const result = await TripService.acceptShipment(
    req.params.id as string,
    req.body,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shipment accepted for trip successfully",
    data: result,
  });
});

const completeTrip = catchAsync(async (req: Request, res: Response) => {
  const result = await TripService.completeTrip(
    req.params.id as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trip completed successfully",
    data: result,
  });
});

export const TripController = {
  createTrip,
  getTrips,
  getTripById,
  updateTrip,
  cancelTrip,
  verifyTrip,
  acceptShipment,
  completeTrip,
};

import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { OfferService } from "./offer.service";

const createOffer = catchAsync(async (req: Request, res: Response) => {
  const result = await OfferService.createOffer(req.body, req.user!);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Offer created successfully",
    data: result,
  });
});

const getOffersForShipment = catchAsync(async (req: Request, res: Response) => {
  const result = await OfferService.getOffersForShipment(
    req.params.id as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Offers fetched successfully",
    data: result,
  });
});

const getReceivedOffers = catchAsync(async (req: Request, res: Response) => {
  const result = await OfferService.getReceivedOffers(req.user!);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Received offers fetched successfully",
    data: result,
  });
});

const getSentOffers = catchAsync(async (req: Request, res: Response) => {
  const result = await OfferService.getSentOffers(req.user!);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Sent offers fetched successfully",
    data: result,
  });
});

const acceptOffer = catchAsync(async (req: Request, res: Response) => {
  const result = await OfferService.acceptOffer(
    req.params.id as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Offer accepted successfully",
    data: result,
  });
});

const rejectOffer = catchAsync(async (req: Request, res: Response) => {
  const result = await OfferService.rejectOffer(
    req.params.id as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Offer rejected successfully",
    data: result,
  });
});

const cancelCheckout = catchAsync(async (req: Request, res: Response) => {
  const result = await OfferService.cancelCheckout(
    req.params.id as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Checkout canceled successfully",
    data: result,
  });
});

export const OfferController = {
  createOffer,
  getOffersForShipment,
  getReceivedOffers,
  getSentOffers,
  acceptOffer,
  cancelCheckout,
  rejectOffer,
};

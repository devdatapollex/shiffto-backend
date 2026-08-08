import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { ReviewService } from "./review.service";

const createReview = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await ReviewService.createReview(userId, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Review submitted successfully",
    data: result,
  });
});

const getShipmentReview = catchAsync(async (req: Request, res: Response) => {
  const currentUserId = req.user!.id;
  const currentUserRole = req.user!.role || "user";
  const shipmentId = req.params.shipmentId as string;

  const result = await ReviewService.getShipmentReview(
    currentUserId,
    currentUserRole,
    shipmentId,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shipment review fetched successfully",
    data: result,
  });
});

const getUserReviewStats = catchAsync(async (req: Request, res: Response) => {
  const currentUserId = req.user!.id;
  const currentUserRole = req.user!.role || "user";
  const userId = req.params.userId as string;

  const result = await ReviewService.getUserReviewStats(
    currentUserId,
    currentUserRole,
    userId,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User review statistics fetched successfully",
    data: result,
  });
});

const getPendingReviewsCount = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const result = await ReviewService.getPendingReviewsCount(userId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Pending review count fetched successfully",
      data: result,
    });
  },
);

const getPendingReviews = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = req.query.search ? String(req.query.search) : undefined;

  const result = await ReviewService.getPendingReviews(userId, {
    page,
    limit,
    search,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Pending reviews fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getUserReceivedReviews = catchAsync(
  async (req: Request, res: Response) => {
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role || "user";
    const userId = req.params.userId as string;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = req.query.search ? String(req.query.search) : undefined;
    const rating = req.query.rating ? Number(req.query.rating) : undefined;

    const result = await ReviewService.getUserReceivedReviews(
      currentUserId,
      currentUserRole,
      userId,
      { page, limit, search, rating },
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Received reviews fetched successfully",
      meta: result.meta,
      data: result.data,
    });
  },
);

const getUserGivenReviews = catchAsync(async (req: Request, res: Response) => {
  const currentUserId = req.user!.id;
  const currentUserRole = req.user!.role || "user";
  const userId = req.params.userId as string;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = req.query.search ? String(req.query.search) : undefined;
  const rating = req.query.rating ? Number(req.query.rating) : undefined;

  const result = await ReviewService.getUserGivenReviews(
    currentUserId,
    currentUserRole,
    userId,
    { page, limit, search, rating },
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Given reviews fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const ReviewController = {
  createReview,
  getShipmentReview,
  getUserReviewStats,
  getPendingReviewsCount,
  getPendingReviews,
  getUserReceivedReviews,
  getUserGivenReviews,
};

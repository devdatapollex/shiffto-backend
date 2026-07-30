import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { paginationHelpers } from "../../helper/paginationHelpers";
import {
  ICreateReviewPayload,
  IReviewPaginationQuery,
} from "./review.interface";

const createReview = async (userId: string, payload: ICreateReviewPayload) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: payload.shipmentId },
    include: {
      trip: true,
    },
  });

  if (!shipment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  if (shipment.status !== "DELIVERED") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Reviews can only be submitted for delivered shipments",
    );
  }

  const existingReview = await prisma.review.findUnique({
    where: {
      shipmentId_reviewerId: {
        shipmentId: payload.shipmentId,
        reviewerId: userId,
      },
    },
  });

  if (existingReview) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "You have already submitted a review for this shipment",
    );
  }

  const isSender = shipment.userId === userId;
  const isTraveler = shipment.trip?.userId === userId;

  if (!isSender && !isTraveler) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only the sender or traveler of this shipment can leave a review",
    );
  }

  const revieweeId = isSender ? shipment.trip!.userId : shipment.userId;

  const newReview = await prisma.review.create({
    data: {
      rating: payload.rating,
      comment: payload.comment || null,
      shipmentId: payload.shipmentId,
      reviewerId: userId,
      revieweeId,
    },
    include: {
      reviewer: { select: { id: true, name: true, image: true } },
      reviewee: { select: { id: true, name: true, image: true } },
      shipment: { select: { id: true, itemName: true } },
    },
  });

  return newReview;
};

const getShipmentReview = async (
  currentUserId: string,
  currentUserRole: string,
  shipmentId: string,
) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      trip: true,
      reviews: {
        include: {
          reviewer: { select: { id: true, name: true, image: true } },
          reviewee: { select: { id: true, name: true, image: true } },
        },
      },
    },
  });

  if (!shipment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  const isAdmin = currentUserRole === "admin";
  const isParticipant =
    shipment.userId === currentUserId ||
    shipment.trip?.userId === currentUserId;

  if (!isAdmin && !isParticipant) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorized to view reviews for this shipment",
    );
  }

  return shipment.reviews;
};

const getUserReviewStats = async (
  currentUserId: string,
  currentUserRole: string,
  targetUserId: string,
) => {
  const isAdmin = currentUserRole === "admin";
  const isSelf = currentUserId === targetUserId;

  if (!isAdmin && !isSelf) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorized to view review statistics for this user",
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const receivedCount = await prisma.review.count({
    where: { revieweeId: targetUserId },
  });

  const givenCount = await prisma.review.count({
    where: { reviewerId: targetUserId },
  });

  const aggregate = await prisma.review.aggregate({
    where: { revieweeId: targetUserId },
    _avg: { rating: true },
  });

  const averageRating = aggregate._avg.rating
    ? Number(aggregate._avg.rating.toFixed(1))
    : 0;

  return {
    averageRating,
    receivedCount,
    givenCount,
  };
};

const getUserReceivedReviews = async (
  currentUserId: string,
  currentUserRole: string,
  targetUserId: string,
  options: IReviewPaginationQuery,
) => {
  const isAdmin = currentUserRole === "admin";
  const isSelf = currentUserId === targetUserId;

  if (!isAdmin && !isSelf) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorized to view reviews for this user",
    );
  }

  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const where = { revieweeId: targetUserId };

  const total = await prisma.review.count({ where });

  const data = await prisma.review.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      reviewer: { select: { id: true, name: true, image: true } },
      shipment: { select: { id: true, itemName: true } },
    },
  });

  const totalPages = Math.ceil(total / limit);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
    data,
  };
};

const getUserGivenReviews = async (
  currentUserId: string,
  currentUserRole: string,
  targetUserId: string,
  options: IReviewPaginationQuery,
) => {
  const isAdmin = currentUserRole === "admin";
  const isSelf = currentUserId === targetUserId;

  if (!isAdmin && !isSelf) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorized to view reviews for this user",
    );
  }

  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const where = { reviewerId: targetUserId };

  const total = await prisma.review.count({ where });

  const data = await prisma.review.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      reviewee: { select: { id: true, name: true, image: true } },
      shipment: { select: { id: true, itemName: true } },
    },
  });

  const totalPages = Math.ceil(total / limit);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
    data,
  };
};

export const ReviewService = {
  createReview,
  getShipmentReview,
  getUserReviewStats,
  getUserReceivedReviews,
  getUserGivenReviews,
};

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

const getPendingReviewsCount = async (userId: string) => {
  const count = await prisma.shipment.count({
    where: {
      status: "DELIVERED",
      OR: [{ userId: userId }, { trip: { userId: userId } }],
      reviews: {
        none: {
          reviewerId: userId,
        },
      },
    },
  });

  return { count };
};

const getPendingReviews = async (
  userId: string,
  options: IReviewPaginationQuery,
) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const where: any = {
    status: "DELIVERED",
    OR: [{ userId: userId }, { trip: { userId: userId } }],
    reviews: {
      none: {
        reviewerId: userId,
      },
    },
  };

  if (options.search) {
    where.AND = [
      {
        OR: [
          { itemName: { contains: options.search, mode: "insensitive" } },
          { user: { name: { contains: options.search, mode: "insensitive" } } },
          {
            trip: {
              user: { name: { contains: options.search, mode: "insensitive" } },
            },
          },
        ],
      },
    ];
  }

  const total = await prisma.shipment.count({ where });

  const shipments = await prisma.shipment.findMany({
    where,
    skip,
    take: limit,
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, image: true } },
      trip: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      },
    },
  });

  const totalPages = Math.ceil(total / limit);

  const data = shipments.map((shipment) => {
    const isSender = shipment.userId === userId;
    const counterparty = isSender
      ? {
          id: shipment.trip?.user?.id || "",
          name: shipment.trip?.user?.name || "Traveler",
          image: shipment.trip?.user?.image || null,
          role: "Traveler",
        }
      : {
          id: shipment.user?.id || "",
          name: shipment.user?.name || "Sender",
          image: shipment.user?.image || null,
          role: "Sender",
        };

    return {
      id: shipment.id,
      itemName: shipment.itemName,
      fromCountry: shipment.fromCountry,
      toCountry: shipment.toCountry,
      deliveredAt: shipment.updatedAt,
      isSender,
      counterparty,
    };
  });

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

  const where: any = { revieweeId: targetUserId };

  if (options.rating) {
    where.rating = Number(options.rating);
  }

  if (options.search) {
    where.AND = [
      {
        OR: [
          { comment: { contains: options.search, mode: "insensitive" } },
          {
            reviewer: {
              name: { contains: options.search, mode: "insensitive" },
            },
          },
          {
            shipment: {
              itemName: { contains: options.search, mode: "insensitive" },
            },
          },
        ],
      },
    ];
  }

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

  const where: any = { reviewerId: targetUserId };

  if (options.rating) {
    where.rating = Number(options.rating);
  }

  if (options.search) {
    where.AND = [
      {
        OR: [
          { comment: { contains: options.search, mode: "insensitive" } },
          {
            reviewee: {
              name: { contains: options.search, mode: "insensitive" },
            },
          },
          {
            shipment: {
              itemName: { contains: options.search, mode: "insensitive" },
            },
          },
        ],
      },
    ];
  }

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
  getPendingReviewsCount,
  getPendingReviews,
  getUserReceivedReviews,
  getUserGivenReviews,
};

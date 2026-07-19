import prisma from "../../lib/prisma";
import { Prisma } from "../../../generated/prisma/client";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";

interface GetUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

const getAllUsers = async (query: GetUsersQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const whereConditions: Prisma.UserWhereInput = {};

  if (query.search) {
    whereConditions.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { phone: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (query.status) {
    const tab = query.status.toUpperCase();
    if (tab === "ACTIVE") {
      whereConditions.status = "ACTIVE";
    } else if (tab === "SUSPENDED") {
      whereConditions.status = "SUSPENDED";
    } else if (tab === "DEACTIVATED") {
      whereConditions.status = "DEACTIVATED";
    } else if (tab === "PENDING_KYC") {
      whereConditions.OR = [
        { status: "PENDING_KYC" },
        { kyc: { status: "PENDING" } }
      ];
    } else if (tab === "INACTIVE") {
      whereConditions.status = "ACTIVE";
      whereConditions.shipments = { none: {} };
      whereConditions.trips = { none: {} };
    }
  }

  const users = await prisma.user.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      kyc: { select: { status: true } },
      _count: {
        select: {
          shipments: true,
          trips: true,
        },
      },
    },
  });

  const total = await prisma.user.count({ where: whereConditions });

  const usersWithActivity = await Promise.all(
    users.map(async (user) => {
      const deliveriesCompleted = await prisma.shipment.count({
        where: {
          status: "DELIVERED",
          trip: {
            userId: user.id,
          },
        },
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        image: user.image,
        createdAt: user.createdAt,
        status: user.status,
        trustScore: user.trustScore,
        commissionRate: user.commissionRate,
        kycStatus: user.kyc?.status || "NOT_SUBMITTED",
        activity: {
          shipmentsCreated: user._count.shipments,
          tripsAdded: user._count.trips,
          deliveriesCompleted,
        },
      };
    })
  );

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: usersWithActivity,
  };
};

const getUserDetail = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      kyc: true,
      reviewsReceived: {
        include: {
          reviewer: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      reviewsGiven: {
        include: {
          reviewee: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      tickets: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
  }

  // Fetch transactions (payments sent as sender & payments received as traveler)
  const transactions = await prisma.paymentTransaction.findMany({
    where: {
      OR: [
        { senderId: userId },
        { travellerId: userId },
      ],
    },
    include: {
      shipment: { select: { itemName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate deliveries completed
  const deliveriesCompleted = await prisma.shipment.count({
    where: {
      status: "DELIVERED",
      trip: { userId },
    },
  });

  // Compile combined activity timeline
  const shipments = await prisma.shipment.findMany({
    where: { userId },
    select: { id: true, itemName: true, createdAt: true },
  });

  const trips = await prisma.trip.findMany({
    where: { userId },
    select: { id: true, fromCountry: true, toCountry: true, createdAt: true },
  });

  const offers = await prisma.offer.findMany({
    where: { travellerId: userId },
    select: {
      id: true,
      createdAt: true,
      shipment: { select: { itemName: true } },
    },
  });

  const tickets = await prisma.ticket.findMany({
    where: { userId },
    select: { id: true, ticketId: true, title: true, createdAt: true },
  });

  const timelineItems: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    date: Date;
  }> = [];

  shipments.forEach((s) => {
    timelineItems.push({
      id: s.id,
      type: "SHIPMENT_CREATED",
      title: "Created Shipment",
      description: `Created shipment "${s.itemName}"`,
      date: s.createdAt,
    });
  });

  trips.forEach((t) => {
    timelineItems.push({
      id: t.id,
      type: "TRIP_ADDED",
      title: "Added Trip",
      description: `Added trip route from ${t.fromCountry} to ${t.toCountry}`,
      date: t.createdAt,
    });
  });

  offers.forEach((o) => {
    timelineItems.push({
      id: o.id,
      type: "OFFER_MADE",
      title: "Sent Traveler Offer",
      description: `Proposed delivery terms for shipment "${o.shipment?.itemName || "Shipment"}"`,
      date: o.createdAt,
    });
  });

  tickets.forEach((t) => {
    timelineItems.push({
      id: t.id,
      type: "TICKET_CREATED",
      title: "Opened Support Ticket",
      description: `Created ticket ${t.ticketId}: "${t.title}"`,
      date: t.createdAt,
    });
  });

  // Sort timeline newest first
  timelineItems.sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      createdAt: user.createdAt,
      status: user.status,
      trustScore: user.trustScore,
      commissionRate: user.commissionRate,
      isDeactivated: user.isDeactivated,
      banned: user.banned,
      role: user.role,
      kycStatus: user.kyc?.status || "NOT_SUBMITTED",
      activity: {
        shipmentsCreated: shipments.length,
        tripsAdded: trips.length,
        deliveriesCompleted,
      },
    },
    kyc: user.kyc,
    reviews: {
      received: user.reviewsReceived,
      given: user.reviewsGiven,
    },
    transactions,
    tickets: user.tickets,
    timeline: timelineItems,
  };
};

const updateUser = async (
  userId: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    commissionRate?: number;
    status?: string;
  }
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
  }

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.commissionRate !== undefined) updateData.commissionRate = Number(data.commissionRate);

  if (data.status !== undefined) {
    const statusUpper = data.status.toUpperCase();
    const validStatuses = ["ACTIVE", "SUSPENDED", "DEACTIVATED", "PENDING_KYC"];
    if (!validStatuses.includes(statusUpper)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid status parameter.");
    }
    updateData.status = statusUpper;

    if (statusUpper === "SUSPENDED") {
      updateData.banned = true;
    } else if (statusUpper === "DEACTIVATED") {
      updateData.isDeactivated = true;
    } else {
      updateData.banned = false;
      updateData.isDeactivated = false;
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  return updatedUser;
};

const bulkActionUsers = async (
  userIds: string[],
  action: "SUSPEND" | "DEACTIVATE" | "DELETE"
) => {
  if (!userIds || userIds.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No user IDs provided.");
  }

  if (action === "SUSPEND") {
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        status: "SUSPENDED",
        banned: true,
      },
    });
  } else if (action === "DEACTIVATE") {
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        status: "DEACTIVATED",
        isDeactivated: true,
      },
    });
  } else if (action === "DELETE") {
    // Delete dependent accounts and sessions first
    await prisma.$transaction([
      prisma.account.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.session.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ]);
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid bulk action.");
  }

  return { success: true };
};

export const AdminUserService = {
  getAllUsers,
  getUserDetail,
  updateUser,
  bulkActionUsers,
};

import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { sendEmail } from "../../lib/email";
import {
  ShipmentStatus,
  shipmentStepStage,
} from "../../../generated/prisma/enums";

// 3 days in milliseconds
const DISPUTE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

interface CreateTicketDto {
  category: string;
  title: string;
  description: string;
  shipmentId?: string;
  tripId?: string;
  attachments?: string[];
}

interface FilterParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  priority?: string;
  assigneeId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

const getAssociatedRecords = async (userId: string) => {
  // Fetch shipments associated with the user that are ACTIVE or DELIVERED
  const shipments = await prisma.shipment.findMany({
    where: {
      userId,
      status: { in: [ShipmentStatus.ACTIVE, ShipmentStatus.DELIVERED] },
    },
    include: {
      shipmentSteps: {
        where: { stage: shipmentStepStage.DELIVERED },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter shipments based on the 3-day dispute window for DELIVERED ones
  const validShipments = shipments.filter((shipment) => {
    if (shipment.status === ShipmentStatus.ACTIVE) return true;

    const deliveredStep = shipment.shipmentSteps[0];
    const deliveryTime = deliveredStep?.completedAt
      ? new Date(deliveredStep.completedAt).getTime()
      : new Date(shipment.updatedAt).getTime();

    return Date.now() - deliveryTime <= DISPUTE_WINDOW_MS;
  });

  // Fetch trips associated with the user that are ACTIVE or COMPLETED
  const trips = await prisma.trip.findMany({
    where: {
      userId,
      status: { in: ["ACTIVE", "COMPLETED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter trips based on the 3-day dispute window for COMPLETED ones
  const validTrips = trips.filter((trip) => {
    if (trip.status === "ACTIVE") return true;

    const completionTime = new Date(trip.updatedAt).getTime();
    return Date.now() - completionTime <= DISPUTE_WINDOW_MS;
  });

  return {
    shipments: validShipments.map((s) => ({
      id: s.id,
      itemName: s.itemName,
      status: s.status,
      fromCountry: s.fromCountry,
      toCountry: s.toCountry,
      createdAt: s.createdAt,
    })),
    trips: validTrips.map((t) => ({
      id: t.id,
      flightNumber: t.flightNumber,
      status: t.status,
      fromCountry: t.fromCountry,
      toCountry: t.toCountry,
      createdAt: t.createdAt,
    })),
  };
};

const createTicket = async (userId: string, data: CreateTicketDto) => {
  const { category, title, description, shipmentId, tripId, attachments } =
    data;

  const validCategories = ["PAYMENT", "DELIVERY", "KYC", "TECHNICAL", "OTHER"];
  const upperCategory = category?.toUpperCase();

  if (!validCategories.includes(upperCategory)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Invalid category. Must be one of ${validCategories.join(", ")}`,
    );
  }

  if (!title?.trim() || !description?.trim()) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Title and description are mandatory fields.",
    );
  }

  // Validate shipment if provided
  if (shipmentId) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        shipmentSteps: {
          where: { stage: shipmentStepStage.DELIVERED },
        },
      },
    });

    if (!shipment || shipment.userId !== userId) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Associated shipment not found.",
      );
    }

    if (
      shipment.status !== ShipmentStatus.ACTIVE &&
      shipment.status !== ShipmentStatus.DELIVERED
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Only active or delivered shipments can be linked to tickets.",
      );
    }

    if (shipment.status === ShipmentStatus.DELIVERED) {
      const deliveredStep = shipment.shipmentSteps[0];
      const deliveryTime = deliveredStep?.completedAt
        ? new Date(deliveredStep.completedAt).getTime()
        : new Date(shipment.updatedAt).getTime();

      if (Date.now() - deliveryTime > DISPUTE_WINDOW_MS) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "The 3-day dispute window for this shipment has expired.",
        );
      }
    }
  }

  // Validate trip if provided
  if (tripId) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip || trip.userId !== userId) {
      throw new ApiError(httpStatus.NOT_FOUND, "Associated trip not found.");
    }

    if (trip.status !== "ACTIVE" && trip.status !== "COMPLETED") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Only active or completed trips can be linked to tickets.",
      );
    }

    if (trip.status === "COMPLETED") {
      const completionTime = new Date(trip.updatedAt).getTime();
      if (Date.now() - completionTime > DISPUTE_WINDOW_MS) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "The 3-day dispute window for this trip has expired.",
        );
      }
    }
  }

  if (attachments && attachments.length > 5) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "A maximum of 5 files can be uploaded as attachments.",
    );
  }

  // Double-update pattern to ensure serial / autoincrement sequence TKT-XXXX ID generation
  const ticket = await prisma.ticket.create({
    data: {
      ticketId: "PENDING",
      userId,
      category: upperCategory,
      title: title.trim(),
      description: description.trim(),
      shipmentId: shipmentId || null,
      tripId: tripId || null,
      attachments: attachments || [],
      status: "OPEN",
      priority: "MEDIUM",
    },
  });

  const formattedTicketId = `TKT-${String(ticket.seq).padStart(4, "0")}`;

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { ticketId: formattedTicketId },
  });

  return updatedTicket;
};

const getMyTickets = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
  status?: string,
) => {
  const skip = (page - 1) * limit;

  const whereClause: any = { userId };
  if (status) {
    whereClause.status = status.toUpperCase();
  }

  const tickets = await prisma.ticket.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
    include: {
      shipment: {
        select: { id: true, itemName: true, status: true },
      },
      trip: {
        select: { id: true, flightNumber: true, status: true },
      },
      assignee: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  const total = await prisma.ticket.count({ where: whereClause });

  return {
    tickets,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getTicketDetails = async (
  userId: string,
  userRole: string,
  id: string,
) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      assignee: {
        select: { id: true, name: true, email: true },
      },
      shipment: {
        select: {
          id: true,
          itemName: true,
          status: true,
          fromCountry: true,
          toCountry: true,
        },
      },
      trip: {
        select: {
          id: true,
          flightNumber: true,
          status: true,
          fromCountry: true,
          toCountry: true,
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
    },
  });

  if (!ticket) {
    throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found.");
  }

  if (userRole !== "admin" && ticket.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied to this ticket.");
  }

  return ticket;
};

const addComment = async (
  userId: string,
  userRole: string,
  ticketId: string,
  message: string,
  attachments?: string[],
) => {
  if (!message?.trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Message cannot be empty.");
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { user: true },
  });

  if (!ticket) {
    throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found.");
  }

  if (userRole !== "admin" && ticket.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied to this ticket.");
  }

  if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Resolved or Closed tickets cannot be reopened. You must create a new ticket.",
    );
  }

  if (userRole !== "admin" && attachments && attachments.length > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Users cannot add attachments in comments.",
    );
  }

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId,
      userId,
      message: message.trim(),
      attachments: attachments || [],
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  // Track SLA First Response
  let slaUpdated = false;
  if (userRole === "admin" && !ticket.slaFirstResponseAt) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { slaFirstResponseAt: new Date() },
    });
    slaUpdated = true;
  }

  // Notify User if Admin commented
  if (userRole === "admin") {
    // 1. Create in-app notification
    await prisma.notification.create({
      data: {
        userId: ticket.userId,
        title: `Reply on ticket ${ticket.ticketId}`,
        message: `Support team has replied to your ticket: "${message.substring(0, 50)}${message.length > 50 ? "..." : ""}"`,
      },
    });

    // 2. Send email notification
    if (ticket.user?.email) {
      try {
        await sendEmail({
          to: ticket.user.email,
          subject: `New Reply on Ticket ${ticket.ticketId} — Shiffto`,
          text: `Hi ${ticket.user.name},\n\nOur support team has replied to your ticket ${ticket.ticketId}.\n\nMessage: "${message.trim()}"\n\nPlease log in to your dashboard to view the conversation.\n\nBest regards,\nShiffto Support Team`,
        });
      } catch (err) {
        console.error(
          "Failed to send email notification on ticket comment",
          err,
        );
      }
    }
  }

  return comment;
};

const closeTicket = async (userId: string, userRole: string, id: string) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!ticket) {
    throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found.");
  }

  if (userRole !== "admin" && ticket.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied.");
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id },
    data: {
      status: "CLOSED",
      slaResolvedAt: ticket.slaResolvedAt || new Date(),
    },
  });

  // Notify user if closed by Admin
  if (userRole === "admin") {
    await prisma.notification.create({
      data: {
        userId: ticket.userId,
        title: `Ticket Closed: ${ticket.ticketId}`,
        message: `Your ticket "${ticket.title}" has been closed by the support team.`,
      },
    });

    if (ticket.user?.email) {
      try {
        await sendEmail({
          to: ticket.user.email,
          subject: `Ticket Closed: ${ticket.ticketId} — Shiffto`,
          text: `Hi ${ticket.user.name},\n\nYour ticket ${ticket.ticketId} ("${ticket.title}") has been marked as CLOSED.\n\nIf you have further questions, please create a new ticket.\n\nBest regards,\nShiffto Support Team`,
        });
      } catch (err) {
        console.error(
          "Failed to send email notification on ticket closure",
          err,
        );
      }
    }
  }

  return updatedTicket;
};

// Admin Services
const getAllTickets = async (params: FilterParams) => {
  const {
    page = 1,
    limit = 10,
    status,
    category,
    priority,
    assigneeId,
    search,
    startDate,
    endDate,
  } = params;

  const skip = (page - 1) * limit;

  const whereClause: any = {};

  if (status) whereClause.status = status.toUpperCase();
  if (category) whereClause.category = category.toUpperCase();
  if (priority) whereClause.priority = priority.toUpperCase();
  if (assigneeId) whereClause.assigneeId = assigneeId;

  if (search) {
    whereClause.OR = [
      { ticketId: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      {
        user: {
          name: { contains: search, mode: "insensitive" },
        },
      },
    ];
  }

  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) {
      whereClause.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      whereClause.createdAt.lte = new Date(endDate);
    }
  }

  const tickets = await prisma.ticket.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      assignee: {
        select: { id: true, name: true, email: true },
      },
      shipment: {
        select: { id: true, itemName: true, status: true },
      },
      trip: {
        select: { id: true, flightNumber: true, status: true },
      },
    },
  });

  const total = await prisma.ticket.count({ where: whereClause });

  return {
    tickets,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const assignTicket = async (ticketId: string, assigneeId: string) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found.");
  }

  const assignee = await prisma.user.findUnique({
    where: { id: assigneeId },
  });

  if (!assignee) {
    throw new ApiError(httpStatus.NOT_FOUND, "Assignee user not found.");
  }

  const updateData: any = { assigneeId };
  if (ticket.status === "OPEN") {
    updateData.status = "IN_PROGRESS";
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: updateData,
    include: {
      assignee: { select: { id: true, name: true } },
    },
  });

  return updatedTicket;
};

const updateTicketStatus = async (ticketId: string, status: string) => {
  const upperStatus = status.toUpperCase();
  const validStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

  if (!validStatuses.includes(upperStatus)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Invalid status. Must be one of ${validStatuses.join(", ")}`,
    );
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { user: true },
  });

  if (!ticket) {
    throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found.");
  }

  const updateData: any = { status: upperStatus };

  if (upperStatus === "RESOLVED" || upperStatus === "CLOSED") {
    updateData.slaResolvedAt = ticket.slaResolvedAt || new Date();
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: updateData,
  });

  // Notify User on status change
  await prisma.notification.create({
    data: {
      userId: ticket.userId,
      title: `Ticket status updated: ${ticket.ticketId}`,
      message: `Your ticket status is now "${upperStatus}".`,
    },
  });

  if (ticket.user?.email) {
    try {
      await sendEmail({
        to: ticket.user.email,
        subject: `Ticket status updated: ${ticket.ticketId} — Shiffto`,
        text: `Hi ${ticket.user.name},\n\nYour ticket ${ticket.ticketId} status has been updated to "${upperStatus}".\n\nPlease log in to your dashboard to view details.\n\nBest regards,\nShiffto Support Team`,
      });
    } catch (err) {
      console.error(
        "Failed to send email notification on ticket status update",
        err,
      );
    }
  }

  return updatedTicket;
};

const updateTicketPriority = async (ticketId: string, priority: string) => {
  const upperPriority = priority.toUpperCase();
  const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

  if (!validPriorities.includes(upperPriority)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Invalid priority. Must be one of ${validPriorities.join(", ")}`,
    );
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found.");
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { priority: upperPriority },
  });

  return updatedTicket;
};

const getAssignees = async () => {
  const assignees = await prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true, name: true, email: true },
  });
  return assignees;
};

export const TicketService = {
  getAssociatedRecords,
  createTicket,
  getMyTickets,
  getTicketDetails,
  addComment,
  closeTicket,
  getAllTickets,
  assignTicket,
  updateTicketStatus,
  updateTicketPriority,
  getAssignees,
};

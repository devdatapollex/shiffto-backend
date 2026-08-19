import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { sendEmail } from "../../lib/email";
import {
  ShipmentStatus,
  shipmentStepStage,
} from "../../../generated/prisma/enums";
import { emitToRoom, notifyAdminCountsUpdated } from "../../lib/socket";
import { NotificationService } from "../notification/notification.service";

// 3 days in milliseconds
const DISPUTE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

const getHtmlEmailTemplate = (
  title: string,
  messageHtml: string,
  actionText?: string,
  actionUrl?: string,
) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f8fafc;
          margin: 0;
          padding: 0;
          color: #334155;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
        }
        .header {
          background-color: #cd071e;
          padding: 30px 40px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.025em;
        }
        .content {
          padding: 40px;
          line-height: 1.6;
        }
        .greeting {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 20px;
          color: #0f172a;
        }
        .message {
          font-size: 15px;
          color: #475569;
          margin-bottom: 30px;
        }
        .action-btn {
          display: inline-block;
          background-color: #cd071e;
          color: #ffffff !important;
          text-decoration: none;
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 600;
          border-radius: 8px;
          text-align: center;
        }
        .footer {
          background-color: #f8fafc;
          padding: 20px 40px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SHIFFTO Support</h1>
        </div>
        <div class="content">
          <div class="greeting">${title}</div>
          <div class="message">${messageHtml}</div>
          ${actionText && actionUrl ? `<div style="text-align: center; margin-top: 30px;"><a href="${actionUrl}" class="action-btn">${actionText}</a></div>` : ""}
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply directly to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Shiffto. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

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

  // Fetch trips associated with the user that are ACTIVE, IN_TRANSIT, ARRIVED or COMPLETED
  const trips = await prisma.trip.findMany({
    where: {
      userId,
      status: { in: ["ACTIVE", "IN_TRANSIT", "ARRIVED", "COMPLETED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter trips based on the 3-day dispute window for COMPLETED ones
  const validTrips = trips.filter((trip) => {
    if (trip.status !== "COMPLETED") return true;

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

  const validCategories = [
    "ORDER",
    "TRIP",
    "PAYMENT",
    "DELIVERY",
    "KYC",
    "TECHNICAL",
    "OTHER",
  ];
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

  let resolvedSenderId: string | null = null;
  let resolvedTravelerId: string | null = null;

  // Validate shipment if provided
  if (shipmentId) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        trip: true,
        shipmentSteps: {
          where: { stage: shipmentStepStage.DELIVERED },
        },
      },
    });

    if (!shipment) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Associated shipment not found.",
      );
    }

    if (shipment.userId !== userId && shipment.trip?.userId !== userId) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Access denied. You are not a party to this shipment.",
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

    resolvedSenderId = shipment.userId;
    resolvedTravelerId = shipment.trip?.userId || null;
  }

  // Validate trip if provided
  if (tripId) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        shipments: true,
      },
    });

    if (!trip) {
      throw new ApiError(httpStatus.NOT_FOUND, "Associated trip not found.");
    }

    const isTripOwner = trip.userId === userId;
    const isShipmentOwner = trip.shipments.some((s) => s.userId === userId);

    if (!isTripOwner && !isShipmentOwner) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Access denied. You are not a party to this trip.",
      );
    }

    const validStatuses = ["ACTIVE", "IN_TRANSIT", "ARRIVED", "COMPLETED"];
    if (!validStatuses.includes(trip.status)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Only active, in-transit, arrived, or completed trips can be linked to tickets.",
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

    resolvedTravelerId = trip.userId;
    const matchedShipment = trip.shipments.find((s) => s.userId === userId);
    resolvedSenderId = matchedShipment
      ? userId
      : trip.shipments[0]?.userId || null;
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
      senderId: resolvedSenderId,
      travelerId: resolvedTravelerId,
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

  // Notify Admins of new support ticket
  try {
    const admins = await prisma.user.findMany({
      where: { role: "admin", isDeactivated: false },
      select: { id: true },
    });

    for (const adminUser of admins) {
      await NotificationService.createNotification({
        userId: adminUser.id,
        title: `New Support Ticket: ${formattedTicketId}`,
        message: `A new ticket "${title.trim()}" was created in ${upperCategory}.`,
      });
    }
  } catch (err) {
    console.error("Failed to send admin notifications for new ticket", err);
  }

  notifyAdminCountsUpdated();
  return updatedTicket;
};

const getMyTickets = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
  status?: string,
) => {
  const skip = (page - 1) * limit;

  const whereClause: any = {
    OR: [{ userId }, { senderId: userId }, { travelerId: userId }],
  };
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

const addComment = async (
  userId: string,
  userRole: string,
  ticketId: string,
  message: string,
  attachments?: string[],
  visibleTo?: string,
) => {
  if (!message?.trim() && (!attachments || attachments.length === 0)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Message or attachment is required.",
    );
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { user: true },
  });

  if (!ticket) {
    throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found.");
  }

  if (
    userRole !== "admin" &&
    ticket.userId !== userId &&
    ticket.senderId !== userId &&
    ticket.travelerId !== userId
  ) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied to this ticket.");
  }

  if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Resolved or Closed tickets cannot be reopened. You must create a new ticket.",
    );
  }

  let resolvedVisibleTo = "ALL";
  if (userRole === "admin") {
    if (
      visibleTo === "SENDER" ||
      visibleTo === "TRAVELER" ||
      visibleTo === "ALL"
    ) {
      resolvedVisibleTo = visibleTo;
    }
  } else {
    const isTraveler =
      ticket.travelerId === userId && ticket.senderId !== userId;
    resolvedVisibleTo = isTraveler ? "TRAVELER" : "SENDER";
  }

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId,
      userId,
      message: message?.trim() || "Attached file(s)",
      attachments: attachments || [],
      visibleTo: resolvedVisibleTo,
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

  // Notify appropriate user(s) if Admin commented
  if (userRole === "admin") {
    const notifyUserIds: string[] = [];
    if (resolvedVisibleTo === "SENDER" || resolvedVisibleTo === "ALL") {
      if (ticket.senderId) {
        notifyUserIds.push(ticket.senderId);
      } else {
        notifyUserIds.push(ticket.userId);
      }
    }
    if (resolvedVisibleTo === "TRAVELER" || resolvedVisibleTo === "ALL") {
      if (ticket.travelerId) {
        notifyUserIds.push(ticket.travelerId);
      } else if (
        resolvedVisibleTo === "ALL" &&
        !notifyUserIds.includes(ticket.userId)
      ) {
        notifyUserIds.push(ticket.userId);
      }
    }

    const uniqueUserIds = [...new Set(notifyUserIds)];

    for (const targetUserId of uniqueUserIds) {
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
      });
      if (!targetUser) continue;

      // 1. Create in-app notification & emit real-time socket event
      await NotificationService.createNotification({
        userId: targetUserId,
        title: `Reply on ticket ${ticket.ticketId}`,
        message: `Support team has replied to your ticket: "${message.substring(0, 50)}${message.length > 50 ? "..." : ""}"`,
      });

      // 2. Send email notification
      if (targetUser.email) {
        try {
          const html = getHtmlEmailTemplate(
            `New Support Reply — ${ticket.ticketId}`,
            `<p>Hi ${targetUser.name},</p>
             <p>Our support team has posted a reply to your ticket <strong>${ticket.ticketId}</strong> ("${ticket.title}").</p>
             <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; border-left: 4px solid #cd071e; margin: 20px 0; font-style: italic; font-size: 15px; color: #1e293b;">
               "${message.trim()}"
             </div>
             <p>Please log in to your dashboard to view the conversation or download any attachments.</p>`,
            "View Conversation",
            `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/support`,
          );

          await sendEmail({
            to: targetUser.email,
            subject: `New Reply on Ticket ${ticket.ticketId} — Shiffto`,
            html,
            text: `Hi ${targetUser.name},\n\nOur support team has replied to your ticket ${ticket.ticketId}.\n\nMessage: "${message.trim()}"\n\nPlease log in to your dashboard to view the conversation.\n\nBest regards,\nShiffto Support Team`,
          });
        } catch (err) {
          console.error(
            `Failed to send email notification on ticket comment to user ${targetUserId}`,
            err,
          );
        }
      }
    }
  } else {
    // Notify assigned Admin (or all Admins if unassigned) when regular User comments
    try {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      const senderName = currentUser?.name || "A user";

      const notifyAdminIds: string[] = [];
      if (ticket.assigneeId) {
        notifyAdminIds.push(ticket.assigneeId);
      } else {
        const admins = await prisma.user.findMany({
          where: { role: "admin", isDeactivated: false },
          select: { id: true },
        });
        admins.forEach((a) => notifyAdminIds.push(a.id));
      }

      for (const adminId of notifyAdminIds) {
        await NotificationService.createNotification({
          userId: adminId,
          title: `User Reply on Ticket ${ticket.ticketId}`,
          message: `${senderName} replied on ticket ${ticket.ticketId}: "${message.substring(0, 50)}${message.length > 50 ? "..." : ""}"`,
        });
      }
    } catch (err) {
      console.error("Failed to notify admins on user ticket comment", err);
    }
  }

  // Socket broadcast of new comment
  try {
    emitToRoom(ticketId, "new-comment", comment);
  } catch (error) {
    console.error("Failed to emit new-comment socket event:", error);
  }

  return comment;
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
          paymentTransaction: {
            select: {
              id: true,
              transactionId: true,
              grossAmount: true,
              refundableAmount: true,
              cancellationFeeAmount: true,
              status: true,
              refundTxnId: true,
              adminRefundNotes: true,
            },
          },
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

  if (
    userRole !== "admin" &&
    ticket.userId !== userId &&
    ticket.senderId !== userId &&
    ticket.travelerId !== userId
  ) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied to this ticket.");
  }

  // Filter comments based on role/privacy
  if (userRole !== "admin") {
    const isTraveler =
      ticket.travelerId === userId && ticket.senderId !== userId;
    const userRoleTag = isTraveler ? "TRAVELER" : "SENDER";

    ticket.comments = ticket.comments.filter((c) => {
      if (c.user.role === "admin") {
        return c.visibleTo === "ALL" || c.visibleTo === userRoleTag;
      }
      return c.userId === userId;
    });
  }

  return ticket;
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
    await NotificationService.createNotification({
      userId: ticket.userId,
      title: `Ticket Closed: ${ticket.ticketId}`,
      message: `Your ticket "${ticket.title}" has been closed by the support team.`,
    });

    if (ticket.user?.email) {
      try {
        const html = getHtmlEmailTemplate(
          `Ticket Closed — ${ticket.ticketId}`,
          `<p>Hi ${ticket.user.name},</p>
           <p>Your support ticket <strong>${ticket.ticketId}</strong> ("${ticket.title}") has been marked as <strong>CLOSED</strong> by the support team.</p>
           <p>If you have any further questions or if you encounter any other issues, please create a new ticket in the support center.</p>`,
          "Go to Support",
          `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/support`,
        );

        await sendEmail({
          to: ticket.user.email,
          subject: `Ticket Closed: ${ticket.ticketId} — Shiffto`,
          html,
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

  // Socket broadcast of status change
  try {
    emitToRoom(id, "ticket-status-updated", {
      ticketId: ticket.ticketId,
      id,
      status: "CLOSED",
    });
  } catch (error) {
    console.error("Failed to emit ticket-status-updated socket event:", error);
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

  // Notify assigned Admin
  try {
    await NotificationService.createNotification({
      userId: assigneeId,
      title: `Ticket Assigned: ${ticket.ticketId}`,
      message: `You have been assigned to support ticket "${ticket.title}".`,
    });
  } catch (err) {
    console.error("Failed to send notification on ticket assignment", err);
  }

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
  await NotificationService.createNotification({
    userId: ticket.userId,
    title: `Ticket status updated: ${ticket.ticketId}`,
    message: `Your ticket status is now "${upperStatus}".`,
  });

  if (ticket.user?.email) {
    try {
      const html = getHtmlEmailTemplate(
        `Ticket Status Updated — ${ticket.ticketId}`,
        `<p>Hi ${ticket.user.name},</p>
         <p>The status of your support ticket <strong>${ticket.ticketId}</strong> ("${ticket.title}") has been updated to <strong>${upperStatus}</strong>.</p>
         <p>Please log in to your dashboard support center to review the status change and join the discussion.</p>`,
        "View Support Ticket",
        `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/support`,
      );

      await sendEmail({
        to: ticket.user.email,
        subject: `Ticket status updated: ${ticket.ticketId} — Shiffto`,
        html,
        text: `Hi ${ticket.user.name},\n\nYour ticket ${ticket.ticketId} status has been updated to "${upperStatus}".\n\nPlease log in to your dashboard to view details.\n\nBest regards,\nShiffto Support Team`,
      });
    } catch (err) {
      console.error(
        "Failed to send email notification on ticket status update",
        err,
      );
    }
  }

  // Socket broadcast of status change
  try {
    emitToRoom(ticketId, "ticket-status-updated", {
      ticketId: ticket.ticketId,
      id: ticketId,
      status: upperStatus,
    });
  } catch (error) {
    console.error("Failed to emit ticket-status-updated socket event:", error);
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

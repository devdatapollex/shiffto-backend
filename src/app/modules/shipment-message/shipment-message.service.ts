import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { emitToRoom } from "../../lib/socket";
import { presenceManager } from "../../lib/presence";
import { NotificationService } from "../notification/notification.service";

interface CreateMessageDto {
  message: string;
  attachments?: string[];
}

const getShipmentMessages = async (
  shipmentId: string,
  userId: string,
  userRole?: string,
) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true, phone: true },
      },
      trip: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  if (!shipment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  const isAdmin = userRole === "admin";
  const isSender = shipment.userId === userId;
  const isTraveler = shipment.trip?.userId === userId;

  if (!isAdmin && !isSender && !isTraveler) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Access denied. You are not authorized to view messages for this shipment.",
    );
  }

  // Determine Counterparty user info
  let counterparty = null;
  let counterpartyRole: "Sender" | "Traveler" | "Participant" = "Participant";

  if (isSender) {
    counterparty = shipment.trip?.user || null;
    counterpartyRole = "Traveler";
  } else if (isTraveler) {
    counterparty = shipment.user || null;
    counterpartyRole = "Sender";
  } else if (isAdmin) {
    counterparty = shipment.user;
    counterpartyRole = "Sender";
  }

  const isCounterpartyOnline = counterparty
    ? presenceManager.isUserOnline(counterparty.id)
    : false;

  // Fetch message history
  const messages = await prisma.shipmentMessage.findMany({
    where: { shipmentId },
    include: {
      sender: {
        select: { id: true, name: true, image: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    shipment: {
      id: shipment.id,
      itemName: shipment.itemName,
      status: shipment.status,
      senderId: shipment.userId,
      travelerId: shipment.trip?.userId || null,
    },
    counterparty: counterparty
      ? {
          id: counterparty.id,
          name: counterparty.name,
          email: counterparty.email,
          image: counterparty.image,
          phone: counterparty.phone,
          role: counterpartyRole,
          isOnline: isCounterpartyOnline,
        }
      : null,
    messages,
  };
};

const sendShipmentMessage = async (
  shipmentId: string,
  senderId: string,
  userRole: string | undefined,
  payload: CreateMessageDto,
) => {
  if (!payload.message || payload.message.trim() === "") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Message text cannot be empty");
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      trip: { select: { userId: true } },
    },
  });

  if (!shipment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  if (shipment.status !== "ACTIVE") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Messaging is only allowed for active shipments",
    );
  }

  const isAdmin = userRole === "admin";
  const isSender = shipment.userId === senderId;
  const isTraveler = shipment.trip?.userId === senderId;

  if (!isAdmin && !isSender && !isTraveler) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Access denied. You are not authorized to send messages for this shipment.",
    );
  }

  // Create message record in DB
  const messageRecord = await prisma.shipmentMessage.create({
    data: {
      shipmentId,
      senderId,
      message: payload.message.trim(),
      attachments: payload.attachments || [],
    },
    include: {
      sender: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  // Emit socket event to shipment room
  const roomName = `shipment:${shipmentId}`;
  emitToRoom(roomName, "shipment-chat:new-message", messageRecord);

  // Identify recipient user and send push notification
  const recipientId = isSender ? shipment.trip?.userId : shipment.userId;
  if (recipientId && recipientId !== senderId) {
    try {
      await NotificationService.createNotification({
        userId: recipientId,
        title: `New message on Shipment #${shipment.id.slice(-6).toUpperCase()}`,
        message: `${messageRecord.sender.name}: ${payload.message.trim().slice(0, 80)}`,
      });
    } catch (err) {
      console.error("Failed to send notification for shipment message:", err);
    }
  }

  return messageRecord;
};

const markMessagesAsRead = async (shipmentId: string, userId: string) => {
  const result = await prisma.shipmentMessage.updateMany({
    where: {
      shipmentId,
      senderId: { not: userId },
      isRead: false,
    },
    data: { isRead: true },
  });

  return result;
};

export const ShipmentMessageService = {
  getShipmentMessages,
  sendShipmentMessage,
  markMessagesAsRead,
};

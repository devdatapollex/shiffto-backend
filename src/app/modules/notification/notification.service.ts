import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { emitToUser } from "../../lib/socket";

const getMyNotifications = async (userId: string) => {
  const result = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50, // limit to latest 50 notifications
  });
  return result;
};

const createNotification = async (data: {
  userId: string;
  title: string;
  message: string;
}) => {
  const notification = await prisma.notification.create({
    data,
  });

  try {
    emitToUser(data.userId, "notification:new", notification);
  } catch (error) {
    console.error("Failed to emit real-time notification socket event:", error);
  }

  return notification;
};

const markAsRead = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notification not found");
  }

  const result = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });

  return result;
};

const markAllAsRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: { read: true },
  });

  return result;
};

export const NotificationService = {
  getMyNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
};

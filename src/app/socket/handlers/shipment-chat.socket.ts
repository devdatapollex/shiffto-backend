import { Server } from "socket.io";
import { AuthenticatedSocket } from "../types";
import prisma from "../../lib/prisma";
import { presenceManager } from "../../lib/presence";

export const registerShipmentChatHandlers = (
  _io: Server,
  socket: AuthenticatedSocket,
) => {
  const user = socket.data.user;

  if (!user || !user.id) return;

  // Join a shipment chat room (with Authorization Guard)
  socket.on("join-shipment-chat", async (shipmentId: string) => {
    try {
      if (!shipmentId || typeof shipmentId !== "string") {
        socket.emit("error", { message: "Invalid shipment ID" });
        return;
      }

      const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        select: {
          id: true,
          userId: true,
          status: true,
          trip: { select: { userId: true } },
        },
      });

      if (!shipment) {
        socket.emit("error", { message: "Shipment not found" });
        return;
      }

      const isAdmin = user.role === "admin";
      const isSender = shipment.userId === user.id;
      const isTraveler = shipment.trip?.userId === user.id;

      if (!isAdmin && !isSender && !isTraveler) {
        console.warn(
          `[Socket] User ${user.name} (${user.id}) denied access to shipment room ${shipmentId}`,
        );
        socket.emit("error", {
          message:
            "Access denied. You are not authorized to join this shipment room.",
        });
        return;
      }

      const roomName = `shipment:${shipmentId}`;
      socket.join(roomName);
      console.log(
        `📦 User ${user.name} (${user.id}) joined shipment room: ${roomName}`,
      );
      socket.emit("user:joined-room", { room: roomName });
    } catch (error) {
      console.error(`Error joining shipment room ${shipmentId}:`, error);
      socket.emit("error", { message: "Failed to join shipment room" });
    }
  });

  // Leave shipment room
  socket.on("leave-shipment-chat", (shipmentId: string) => {
    if (shipmentId && typeof shipmentId === "string") {
      const roomName = `shipment:${shipmentId}`;
      socket.leave(roomName);
      console.log(
        `🚪 User ${user.name} (${user.id}) left shipment room: ${roomName}`,
      );
      socket.emit("user:left-room", { room: roomName });
    }
  });

  // Handle Typing indicator
  socket.on(
    "shipment-chat:typing",
    ({ shipmentId, isTyping }: { shipmentId: string; isTyping: boolean }) => {
      if (!shipmentId) return;
      const roomName = `shipment:${shipmentId}`;
      socket.to(roomName).emit("shipment-chat:typing", {
        userId: user.id,
        isTyping,
      });
    },
  );

  // Check presence of counterparty
  socket.on(
    "shipment-chat:check-presence",
    ({
      shipmentId: _shipmentId,
      counterpartyId,
    }: {
      shipmentId: string;
      counterpartyId: string;
    }) => {
      if (!counterpartyId) return;
      const isOnline = presenceManager.isUserOnline(counterpartyId);
      socket.emit("shipment-chat:presence-status", {
        counterpartyId,
        isOnline,
      });
    },
  );
};

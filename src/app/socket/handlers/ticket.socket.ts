import { Server } from "socket.io";
import { AuthenticatedSocket } from "../types";
import prisma from "../../lib/prisma";

export const registerTicketHandlers = (
  _io: Server,
  socket: AuthenticatedSocket,
) => {
  const user = socket.data.user;

  // Join a ticket conversation room (with Authorization Guard)
  socket.on("join-ticket", async (ticketId: string) => {
    try {
      if (!ticketId || typeof ticketId !== "string") {
        socket.emit("error", { message: "Invalid ticket ID" });
        return;
      }

      // Fetch ticket to verify authorization
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, userId: true, senderId: true, travelerId: true },
      });

      if (!ticket) {
        console.warn(
          `[Socket] Ticket ${ticketId} not found for join attempt by User ${user.id}`,
        );
        socket.emit("error", { message: "Ticket not found" });
        return;
      }

      // Authorization guard: Must be Admin OR ticket creator/sender/traveler
      const isAdmin = user.role === "admin";
      const isParticipant =
        ticket.userId === user.id ||
        ticket.senderId === user.id ||
        ticket.travelerId === user.id;

      if (!isAdmin && !isParticipant) {
        console.warn(
          `[Socket] User ${user.name} (${user.id}) denied access to ticket room ${ticketId}`,
        );
        socket.emit("error", {
          message:
            "Access denied. You are not authorized to join this ticket room.",
        });
        return;
      }

      socket.join(ticketId);
      console.log(
        `🎟️ User ${user.name} (${user.id}) joined ticket room: ${ticketId}`,
      );
      socket.emit("user:joined-room", { room: ticketId });
    } catch (error) {
      console.error(`Error joining ticket room ${ticketId}:`, error);
      socket.emit("error", { message: "Failed to join ticket room" });
    }
  });

  // Leave a specific ticket conversation room
  socket.on("leave-ticket", (ticketId: string) => {
    if (ticketId && typeof ticketId === "string") {
      socket.leave(ticketId);
      console.log(
        `🚪 User ${user.name} (${user.id}) left ticket room: ${ticketId}`,
      );
      socket.emit("user:left-room", { room: ticketId });
    }
  });
};

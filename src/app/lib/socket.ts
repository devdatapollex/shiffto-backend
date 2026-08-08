import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { fromNodeHeaders } from "better-auth/node";
import config from "../../config/index";
import { auth, User } from "./auth";
import prisma from "./prisma";
import {
  AuthenticatedSocket,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../socket/types";
import { registerPresenceHandlers } from "../socket/handlers/presence.socket";
import { registerTicketHandlers } from "../socket/handlers/ticket.socket";
import { registerShipmentChatHandlers } from "../socket/handlers/shipment-chat.socket";

let io: SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> | null = null;

export const initSocket = (server: HttpServer) => {
  const allowedOrigins = [
    config.frontend_url,
    config.mobile_app_url,
    "http://localhost:3000",
    "http://localhost:3001",
  ].filter(Boolean) as string[];

  io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(server, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
      methods: ["GET", "POST", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  // 🔒 Socket.io Authentication Middleware via Better Auth
  io.use(async (socket, next) => {
    try {
      // 1. Build headers object combining socket request headers & handshake auth bearer token
      const reqHeaders = new Headers(fromNodeHeaders(socket.request.headers));

      const handshakeToken =
        socket.handshake.auth?.token || socket.handshake.headers?.authorization;

      if (handshakeToken && !reqHeaders.has("authorization")) {
        const authValue = handshakeToken.startsWith("Bearer ")
          ? handshakeToken
          : `Bearer ${handshakeToken}`;
        reqHeaders.set("authorization", authValue);
      }

      // 2. Validate session using Better Auth
      const session = await auth.api.getSession({
        headers: reqHeaders,
      });

      if (!session?.user?.id) {
        return next(
          new Error("Authentication error: Unauthorized socket connection"),
        );
      }

      // 3. Check user deactivation state and attach to socket
      const user = session.user as unknown as User & {
        isDeactivated?: boolean;
      };

      if (user.isDeactivated) {
        return next(
          new Error("Authentication error: User inactive or not found"),
        );
      }

      // 4. Attach authenticated user to socket data
      socket.data.user = user as unknown as User;
      next();
    } catch (err) {
      console.error("Socket authentication error:", err);
      next(new Error("Authentication error: Internal server error"));
    }
  });

  // 🔌 Connection Handler
  io.on("connection", (socket: AuthenticatedSocket) => {
    // Register modular handlers
    registerPresenceHandlers(io!, socket);
    registerTicketHandlers(io!, socket);
    registerShipmentChatHandlers(io!, socket);
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io has not been initialized!");
  }
  return io;
};

/**
 * Helper to emit event to a specific room
 */
export const emitToRoom = <K extends keyof ServerToClientEvents>(
  roomId: string,
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
) => {
  if (io) {
    console.log(
      `📢 [Socket Broadcast] Emitting '${String(event)}' to room: ${roomId}`,
    );
    (io.to(roomId) as any).emit(event, ...args);
  } else {
    console.warn(
      `⚠️ [Socket Broadcast] Attempted to emit '${String(event)}' to room ${roomId} before socket init.`,
    );
  }
};

/**
 * Helper to emit event to a specific user's personal room
 */
export const emitToUser = <K extends keyof ServerToClientEvents>(
  userId: string,
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
) => {
  if (io) {
    console.log(
      `📢 [Socket Broadcast] Emitting '${String(event)}' to user:${userId}`,
    );
    (io.to(`user:${userId}`) as any).emit(event, ...args);
  } else {
    console.warn(
      `⚠️ [Socket Broadcast] Attempted to emit '${String(event)}' to user:${userId} before socket init.`,
    );
  }
};

/**
 * Helper to notify all connected admins that sidebar counts need invalidation
 */
export const notifyAdminCountsUpdated = () => {
  emitToRoom("admin", "admin-counts:updated");
};

/**
 * Helper to notify a specific user that their received offers count changed
 */
export const notifyOffersCountUpdated = (userId: string) => {
  emitToUser(userId, "offers-count:updated");
};

/**
 * Helper to notify all clients that available shipments count changed
 */
export const notifyAvailableShipmentsCountUpdated = () => {
  if (io) {
    console.log(
      `📢 [Socket Broadcast] Emitting 'available-shipments-count:updated' globally`,
    );
    (io as any).emit("available-shipments-count:updated");
  }
};

import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | null = null;

export const initSocket = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*", // Adjust origins if needed in production
      methods: ["GET", "POST", "PATCH"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket client connected: ${socket.id}`);

    // Join a specific ticket conversation room
    socket.on("join-ticket", (ticketId: string) => {
      socket.join(ticketId);
      console.log(`Socket client ${socket.id} joined ticket room: ${ticketId}`);
    });

    // Leave a specific ticket conversation room
    socket.on("leave-ticket", (ticketId: string) => {
      socket.leave(ticketId);
      console.log(`Socket client ${socket.id} left ticket room: ${ticketId}`);
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error("Socket.io has not been initialized!");
  }
  return io;
};

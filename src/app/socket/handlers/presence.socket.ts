import { Server } from "socket.io";
import { AuthenticatedSocket } from "../types";
import { presenceManager } from "../../lib/presence";

export const registerPresenceHandlers = (
  io: Server,
  socket: AuthenticatedSocket,
) => {
  const user = socket.data.user;

  if (!user || !user.id) {
    return;
  }

  // 1. Join personal user notification room
  const userRoom = `user:${user.id}`;
  socket.join(userRoom);

  // 2. If user is an Admin, join the restricted 'admin' room
  if (user.role === "admin") {
    socket.join("admin");
  }

  // 3. Log socket connection details to server console
  console.log(
    `🔌 Socket connected | User: ${user.name} (${user.email}) | Role: ${user.role} | ID: ${user.id} | Room: ${userRoom} | Socket ID: ${socket.id}`,
  );

  // 4. Track connection in PresenceManager
  const isFirstConnection = presenceManager.addSocket(user.id, socket.id);
  if (isFirstConnection) {
    // Notify ONLY admins of user online presence (Privacy Guard: Do not broadcast globally)
    io.to("admin").emit("presence:update", { userId: user.id, isOnline: true });
  }

  // 5. Handle disconnection
  socket.on("disconnect", (reason) => {
    const { userId, isCompletelyOffline } = presenceManager.removeSocket(
      socket.id,
    );
    console.log(
      `🔌 Socket disconnected | User: ${user.name} (${user.id}) | Socket ID: ${socket.id} | Reason: ${reason}`,
    );

    if (userId && isCompletelyOffline) {
      // Notify ONLY admins when a user goes completely offline
      io.to("admin").emit("presence:update", { userId, isOnline: false });
    }
  });
};

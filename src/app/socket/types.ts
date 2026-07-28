import { Socket } from "socket.io";
import { User } from "../lib/auth";

export interface ServerToClientEvents {
  "new-comment": (comment: any) => void;
  "ticket-status-updated": (data: {
    ticketId: string;
    id: string;
    status: string;
  }) => void;
  "presence:update": (data: { userId: string; isOnline: boolean }) => void;
  "user:joined-room": (data: { room: string }) => void;
  "user:left-room": (data: { room: string }) => void;
  error: (data: { message: string; code?: string }) => void;
}

export interface ClientToServerEvents {
  "join-ticket": (ticketId: string) => void;
  "leave-ticket": (ticketId: string) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user: User;
}

export type AuthenticatedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

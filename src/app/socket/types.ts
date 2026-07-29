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
  "notification:new": (notification: any) => void;
  "admin-counts:updated": () => void;
  "offers-count:updated": () => void;
  "available-shipments-count:updated": () => void;
  "shipment-chat:new-message": (message: any) => void;
  "shipment-chat:typing": (data: { userId: string; isTyping: boolean }) => void;
  "shipment-chat:presence-status": (data: {
    counterpartyId: string;
    isOnline: boolean;
  }) => void;
  error: (data: { message: string; code?: string }) => void;
}

export interface ClientToServerEvents {
  "join-ticket": (ticketId: string) => void;
  "leave-ticket": (ticketId: string) => void;
  "join-shipment-chat": (shipmentId: string) => void;
  "leave-shipment-chat": (shipmentId: string) => void;
  "shipment-chat:typing": (data: {
    shipmentId: string;
    isTyping: boolean;
  }) => void;
  "shipment-chat:check-presence": (data: {
    shipmentId: string;
    counterpartyId: string;
  }) => void;
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

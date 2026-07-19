import express from "express";
import authGuard from "../../middlewares/authGuard";
import { TicketController } from "./ticket.controller";

const router = express.Router();

// User routes
router.get(
  "/associated-records",
  authGuard(),
  TicketController.getAssociatedRecords,
);
router.post("/", authGuard(), TicketController.createTicket);
router.get("/", authGuard(), TicketController.getMyTickets);
router.get("/:id", authGuard(), TicketController.getTicketDetails);
router.post("/:id/comments", authGuard(), TicketController.addComment);
router.patch("/:id/close", authGuard(), TicketController.closeTicket);

// Admin routes
router.get(
  "/admin/list",
  authGuard({ adminOnly: true }),
  TicketController.getAllTickets,
);
router.get(
  "/admin/assignees",
  authGuard({ adminOnly: true }),
  TicketController.getAssignees,
);
router.patch(
  "/admin/:id/assign",
  authGuard({ adminOnly: true }),
  TicketController.assignTicket,
);
router.patch(
  "/admin/:id/status",
  authGuard({ adminOnly: true }),
  TicketController.updateTicketStatus,
);
router.patch(
  "/admin/:id/priority",
  authGuard({ adminOnly: true }),
  TicketController.updateTicketPriority,
);

export const TicketRoutes = router;

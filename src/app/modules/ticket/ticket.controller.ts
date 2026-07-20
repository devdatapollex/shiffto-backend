import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import { TicketService } from "./ticket.service";

const getAssociatedRecords = catchAsync(async (req: Request, res: Response) => {
  const result = await TicketService.getAssociatedRecords(req.user!.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Associated shipments and trips fetched successfully",
    data: result,
  });
});

const createTicket = catchAsync(async (req: Request, res: Response) => {
  const result = await TicketService.createTicket(req.user!.id, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Support ticket created successfully",
    data: result,
  });
});

const getMyTickets = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const status = req.query.status as string | undefined;

  const result = await TicketService.getMyTickets(
    req.user!.id,
    page,
    limit,
    status,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Tickets fetched successfully",
    meta: result.meta,
    data: result.tickets,
  });
});

const getTicketDetails = catchAsync(async (req: Request, res: Response) => {
  const result = await TicketService.getTicketDetails(
    req.user!.id,
    req.user!.role || "user",
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ticket details fetched successfully",
    data: result,
  });
});

const addComment = catchAsync(async (req: Request, res: Response) => {
  const { message, attachments, visibleTo } = req.body;
  const result = await TicketService.addComment(
    req.user!.id,
    req.user!.role || "user",
    req.params.id as string,
    message,
    attachments,
    visibleTo,
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Reply sent successfully",
    data: result,
  });
});

const closeTicket = catchAsync(async (req: Request, res: Response) => {
  const result = await TicketService.closeTicket(
    req.user!.id,
    req.user!.role || "user",
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ticket closed successfully",
    data: result,
  });
});

// Admin Controllers
const getAllTickets = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const status = req.query.status as string | undefined;
  const category = req.query.category as string | undefined;
  const priority = req.query.priority as string | undefined;
  const assigneeId = req.query.assigneeId as string | undefined;
  const search = req.query.search as string | undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const result = await TicketService.getAllTickets({
    page,
    limit,
    status,
    category,
    priority,
    assigneeId,
    search,
    startDate,
    endDate,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All tickets fetched successfully",
    meta: result.meta,
    data: result.tickets,
  });
});

const assignTicket = catchAsync(async (req: Request, res: Response) => {
  const { assigneeId } = req.body;
  const result = await TicketService.assignTicket(
    req.params.id as string,
    assigneeId,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ticket assigned successfully",
    data: result,
  });
});

const updateTicketStatus = catchAsync(async (req: Request, res: Response) => {
  const { status } = req.body;
  const result = await TicketService.updateTicketStatus(
    req.params.id as string,
    status,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ticket status updated successfully",
    data: result,
  });
});

const updateTicketPriority = catchAsync(async (req: Request, res: Response) => {
  const { priority } = req.body;
  const result = await TicketService.updateTicketPriority(
    req.params.id as string,
    priority,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ticket priority updated successfully",
    data: result,
  });
});

const getAssignees = catchAsync(async (_req: Request, res: Response) => {
  const result = await TicketService.getAssignees();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Assignee support members fetched successfully",
    data: result,
  });
});

export const TicketController = {
  getAssociatedRecords,
  createTicket,
  getMyTickets,
  getTicketDetails,
  addComment,
  closeTicket,
  getAllTickets,
  assignTicket,
  updateTicketStatus,
  updateTicketPriority,
  getAssignees,
};

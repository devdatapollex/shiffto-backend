import { Request, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import sendResponse from "../../lib/sendResponse";
import httpStatus from "http-status";
import { PaymentService } from "./payment.service";
import { StripeAdapter } from "./payment.adapter";
import ApiError from "../../errors/ApiError";

const getSenderSummary = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const result = await PaymentService.getSenderPaymentsSummary(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sender payment summary fetched successfully",
    data: result,
  });
});

const getTravelerSummary = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const result = await PaymentService.getTravelerEarningsSummary(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Traveler earnings summary fetched successfully",
    data: result,
  });
});

const releasePayment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const transactionId = req.params.transactionId as string;
  const result = await PaymentService.releasePayment(transactionId, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment released to traveler successfully",
    data: result,
  });
});

const handleStripeWebhook = catchAsync(async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const stripeAdapter = new StripeAdapter();

  let event;
  try {
    event = stripeAdapter.verifyWebhookEvent(req.body, sig);
  } catch (err: any) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const transactionId =
      session.client_reference_id || session.metadata?.transactionId;
    if (transactionId) {
      await PaymentService.handlePaymentSuccess(
        transactionId,
        session.payment_intent as string,
      );
    }
  } else if (
    event.type === "checkout.session.expired" ||
    event.type === "payment_intent.payment_failed"
  ) {
    const session = event.data.object as any;
    const transactionId =
      session.client_reference_id || session.metadata?.transactionId;
    if (transactionId) {
      await PaymentService.handlePaymentFailureOrExpiration(transactionId);
    }
  }

  res.status(httpStatus.OK).json({ received: true });
});

const getAdminPayments = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.getAdminPayments(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin payment transactions fetched successfully",
    data: result,
  });
});

const getPendingRefunds = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.getPendingRefunds(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Pending refunds fetched successfully",
    data: result,
  });
});

const processAdminRefund = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const transactionId = req.params.transactionId as string;
  const result = await PaymentService.processAdminRefund(
    transactionId,
    req.body,
    user,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Refund processed successfully",
    data: result,
  });
});

export const PaymentController = {
  getSenderSummary,
  getTravelerSummary,
  releasePayment,
  handleStripeWebhook,
  getAdminPayments,
  getPendingRefunds,
  processAdminRefund,
};

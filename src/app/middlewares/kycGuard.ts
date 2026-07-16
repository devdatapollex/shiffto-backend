import { RequestHandler } from "express";
import httpStatus from "http-status";
import prisma from "../lib/prisma";
import catchAsync from "../lib/catchAsync";
import ApiError from "../errors/ApiError";

const kycGuard = (): RequestHandler =>
  catchAsync(async (req, _res, next) => {
    if (!req.user) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Not authenticated");
    }

    if (req.user.role === "admin") {
      return next();
    }

    const kyc = await prisma.kyc.findUnique({
      where: { userId: req.user.id },
    });

    if (!kyc || kyc.status !== "APPROVED") {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "KYC verification is required to perform this action. Your status must be APPROVED.",
      );
    }

    next();
  });

export default kycGuard;

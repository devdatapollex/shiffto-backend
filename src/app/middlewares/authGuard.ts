import { RequestHandler } from "express";
import httpStatus from "http-status";
import { fromNodeHeaders } from "better-auth/node";
import { auth, User } from "../lib/auth";
import prisma from "../lib/prisma";
import catchAsync from "../lib/catchAsync";
import ApiError from "../errors/ApiError";

type AuthGuardOptions = {
  adminOnly?: boolean;
};

const authGuard = (options: AuthGuardOptions = {}): RequestHandler =>
  catchAsync(async (req, _res, next) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Not authenticated");
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!dbUser) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "User not found");
    }

    if (dbUser.isDeactivated) {
      throw new ApiError(httpStatus.FORBIDDEN, "Account is deactivated");
    }

    if (options.adminOnly && dbUser.role !== "admin") {
      throw new ApiError(httpStatus.FORBIDDEN, "Admin access required");
    }

    if (dbUser.role !== "admin" && !dbUser.emailVerified) {
      throw new ApiError(httpStatus.FORBIDDEN, "Email verification required");
    }

    req.user = dbUser as unknown as User;

    next();
  });

export default authGuard;

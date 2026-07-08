import { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
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
      throw new ApiError(401, "Not authenticated");
    }

    req.user = session.user;

    if (options.adminOnly && session.user.role !== "admin") {
      throw new ApiError(403, "Admin access required");
    }

    if (session.user.role !== "admin" && !session.user.emailVerified) {
      throw new ApiError(403, "Email verification required");
    }

    next();
  });

export default authGuard;

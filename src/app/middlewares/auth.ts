import { NextFunction, Request, Response } from "express"
import { JwtHelper } from "../helper/jwtHelper";
import ApiError from "../errors/ApiError";
import httpStatus from "http-status";
const auth = (...roles: string[]) => {
    return async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
        try {
            const token = req.cookies.accessToken;
            if (!token) {
                throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not authorized to access this route');
            }

            //verify token
            const verifyUser = JwtHelper.verifyToken(token, process.env.JWT_SECRET as string);
            req.user = verifyUser;
            //role based authorization
            if (roles.length && !roles.includes(verifyUser.role)) {
                throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not authorized to access this route');
            }

            
            next();
        } catch (error) {
            next(error);
        }
    }
}

export default auth;
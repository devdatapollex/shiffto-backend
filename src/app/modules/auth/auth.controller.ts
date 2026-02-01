import catchAsync from "../../shared/catchAsync";
import { NextFunction, Request, Response } from "express";

import sendResponse from "../../shared/sendResponse";
import { AuthService } from "./auth.service";

const login = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.login(req.body)
    // console.log(req.body);

    const { accessToken, refreshToken} = result;

    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 60 * 60 * 1000, // 1hour
    });
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
    });

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "User logged in successfully",
        data: '',
    })

}) 

export const AuthController = {
    login
}

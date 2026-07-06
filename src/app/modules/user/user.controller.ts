import { NextFunction, Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import {userService} from "./user.service";
import {userFilterableFields} from "./user.constant";
import pick from "../../helper/pick";

const createPatient = catchAsync(async (req: Request, res: Response) => {
    const result = await userService.createPatient(req)
    // console.log(req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Patient created successfully",
        data: result,
    })

})


const createAdmin = catchAsync(async (req: Request, res: Response) => {
    const result = await userService.createAdmin(req)
    // console.log(req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Admin created successfully",
        data: result,
    })

})

const getAllFromDB = catchAsync(async (req: Request, res: Response) => {
    const filters = pick(req.query, userFilterableFields);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await userService.getAllFromDB(filters, options);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Users retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

export const userController = {
    createPatient,
    createAdmin,
    getAllFromDB,
}

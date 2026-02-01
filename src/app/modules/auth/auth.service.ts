import { UserStatus } from "@prisma/client";
import prisma from "../../shared/prisma";
import bcrypt from 'bcryptjs';
import config from "../../../config";
import { JwtHelper } from "../../helper/jwtHelper";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";

const login = async(payload:{email: string, password: string}) => {
    const user  = await prisma.user.findUniqueOrThrow({
        where:{
             email: payload.email,
            status: UserStatus.ACTIVE
        }
    })
    const isCorrectPassword = await bcrypt.compare(payload.password, user.password);
    if(!isCorrectPassword){
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid credentials');
    }

    const accessToken = JwtHelper.generateToken({
        email: user.email,
        role: user.role,
    }, config.jwt_secret as string, '1h');

    const refreshToken = JwtHelper.generateToken({
      email: user.email,
      role: user.role,
    },  config.jwt_secret as string, '90d');

    return {
        accessToken,
        refreshToken
    };
};

export const AuthService = {
    login
};
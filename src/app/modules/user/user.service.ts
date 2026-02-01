import { Request } from "express";
import prisma from "../../shared/prisma";
import bcrypt from "bcryptjs";
import { fileUploader } from "../../helper/fileUploader";
import { paginationHelpers } from "../../helper/paginationHelpers";
import { Prisma } from "@prisma/client";
import { userSearchableFields } from "./user.constant";

const createPatient = async (req:Request) => {

    if(req.file){
        const uploadResult = await fileUploader.uploadToCloudinary(req.file);
        req.body.patient.profileImage = uploadResult.secure_url;
    }


    const hashPassword = await bcrypt.hash(req.body.password, 10);

    const result =await prisma.$transaction(async (tx) => {
        await tx.user.create({
            data: {
                email: req.body.patient.email,
                password: hashPassword,

            }
        })
        return await tx.patient.create({
            data: {
                name: req.body.patient.name,
                email: req.body.patient.email,
                profilePhoto: req.body.patient.profileImage,
            }
        });

    });

    return result;
};

const createAdmin = async (req:Request) => {

    if(req.file){
        const uploadResult = await fileUploader.uploadToCloudinary(req.file);
        req.body.admin.profileImage = uploadResult.secure_url;
    }
    const hashPassword = await bcrypt.hash(req.body.password, 10);

    const result =await prisma.$transaction(async (tx) => {
        await tx.user.create({
            data: {
                email: req.body.admin.email,
                password: hashPassword,
                role: 'ADMIN',

            }
        })
        return await tx.admin.create({
            data: {
                name: req.body.admin.name,
                email: req.body.admin.email,
                profilePhoto: req.body.admin.profileImage,
                password: hashPassword,
                contactNumber: req.body.admin.contactNumber,
            }
        });

    });

    return result;
}

const getAllFromDB = async (params:any, options:any) => {

    const {page, limit,skip, sortBy, sortOrder} = paginationHelpers.calculatePagination(options);

    const {searchTerm, ...filterData} = params;

    const andConditions : Prisma.UserWhereInput[] = [];

    if(searchTerm){
        andConditions.push({
            OR: userSearchableFields.map((field)=>({
                [field]:{
                    contains: searchTerm,
                    mode: 'insensitive',
                }
            }))
        });
    }

    if(Object.keys(filterData).length > 0){
        andConditions.push({
            AND:Object.keys(filterData).map((key) => ({
                [key]: {
                    equals: (filterData as any)[key],
                }
            }) 
        )
        });
    }

    const whereConditions : Prisma.UserWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.user.findMany({
        skip,
        take: limit,
        where: whereConditions,
        orderBy:{
            [sortBy]: sortOrder,
        } 
    });

    const total = await prisma.user.count({
        where: whereConditions,
    });
    return {
        meta: {
            page,
            limit,
            total,
        },
        data: result,
    };
};
export const userService = {
    createPatient,
    createAdmin,
    getAllFromDB,
}
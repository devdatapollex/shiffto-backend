import express, { NextFunction, Request, Response } from 'express'
import { userController } from './user.controller';
import { fileUploader } from '../../helper/fileUploader';
import { UserValidation } from './user.validation';
import validateRequest from '../../middlewares/validateRequest';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';


const router = express.Router();

router.post('/create-patient',
    fileUploader.upload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
        req.body =UserValidation.createPatientZodSchema.parse(JSON.parse(req.body.data));
        return userController.createPatient(req, res, next);
    }
);

router.post('/create-admin',
    fileUploader.upload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
        req.body =UserValidation.createAdminZodSchema.parse(JSON.parse(req.body.data));
        return userController.createAdmin(req, res, next);
    }
);

router.get('/',
    auth(UserRole.ADMIN),
    userController.getAllFromDB
);


export const userRoutes = router;
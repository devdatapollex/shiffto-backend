import { Router } from "express";
import authGuard from "../../middlewares/authGuard";
import { fileUploader } from "../../helper/fileUploader";
import { UploadController } from "./upload.controller";
import { PHOTO_UPLOAD } from "./upload.validation";

const router = Router();

router.post(
  "/",
  authGuard(),
  fileUploader.upload.array("photos", PHOTO_UPLOAD.MAX_FILES),
  UploadController.uploadPhotos,
);

export const UploadRoutes = router;

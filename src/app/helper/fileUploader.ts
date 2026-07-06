import multer from "multer";
import path from "path";
import {v2 as cloudinary} from 'cloudinary';
import config from "../../config/index";

cloudinary.config({
  cloud_name: config.cloudinary.cloud_name,
  api_key: config.cloudinary.api_key,
  api_secret: config.cloudinary.api_secret
});
const uploadToCloudinary = async (file: Express.Multer.File) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      public_id: `${Date.now()}-${file.originalname}`,
      folder: 'health_care_app'
    });
    return result;
  } catch (error) {
    throw error;
  }
}

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, path.join(process.cwd(), 'uploads'))
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix)
  }
})

const upload = multer({ storage: storage })

export const fileUploader ={
  upload,
  uploadToCloudinary
}
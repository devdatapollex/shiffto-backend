import multer from "multer";
import {
  uploadToPublicBucket,
  uploadToPrivateBucket,
  getPresignedUrl,
  deleteObject,
} from "../lib/storage";

const upload = multer({ storage: multer.memoryStorage() });

function generateKey(folder: string, originalname: string): string {
  const timestamp = Date.now();
  return `${folder}/${timestamp}-${originalname}`;
}

export const fileUploader = {
  upload,

  uploadPublic: async (file: Express.Multer.File, folder = "public") => {
    const key = generateKey(folder, file.originalname);
    return uploadToPublicBucket(key, file.buffer, file.mimetype);
  },

  uploadPrivate: async (file: Express.Multer.File, folder = "private") => {
    const key = generateKey(folder, file.originalname);
    return uploadToPrivateBucket(key, file.buffer, file.mimetype);
  },

  getPrivateUrl: async (key: string, expiresIn?: number) => {
    return getPresignedUrl(key, expiresIn);
  },

  deleteFile: async (key: string) => {
    return deleteObject(key);
  },
};

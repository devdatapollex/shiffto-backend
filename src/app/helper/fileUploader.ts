import multer from "multer";
import config from "../../config/index";
import {
  uploadToPublicBucket,
  uploadToPrivateBucket,
  getPresignedUrl,
  deleteObject,
  deleteFromPublicBucket,
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

  deletePublicFile: async (key: string) => {
    return deleteFromPublicBucket(key);
  },

  extractKey: (url: string): string => {
    const prefix = `${config.r2.public_url}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : url;
  },
};

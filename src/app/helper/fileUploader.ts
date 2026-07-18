import multer from "multer";
import fs from "fs";
import path from "path";
import config from "../../config/index";
import {
  uploadToPublicBucket,
  uploadToPrivateBucket,
  getPresignedUrl,
  deleteObject,
  deleteFromPublicBucket,
} from "../lib/storage";

const upload = multer({ storage: multer.memoryStorage() });

const isR2Configured = !!(
  config.r2.account_id &&
  config.r2.access_key_id &&
  config.r2.secret_access_key
);

function generateKey(folder: string, originalname: string): string {
  const timestamp = Date.now();
  return `${folder}/${timestamp}-${originalname.replace(/\s+/g, "_")}`;
}

async function saveFileLocally(
  file: Express.Multer.File,
): Promise<{ key: string; url: string }> {
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const timestamp = Date.now();
  const filename = `${timestamp}-${file.originalname.replace(/\s+/g, "_")}`;
  const filePath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(filePath, file.buffer);

  const port = config.port || 5000;
  const url = `http://localhost:${port}/uploads/${filename}`;
  return { key: filename, url };
}

export const fileUploader = {
  upload,

  uploadPublic: async (file: Express.Multer.File, folder = "public") => {
    if (!isR2Configured) {
      return saveFileLocally(file);
    }
    const key = generateKey(folder, file.originalname);
    return uploadToPublicBucket(key, file.buffer, file.mimetype);
  },

  uploadPrivate: async (file: Express.Multer.File, folder = "private") => {
    if (!isR2Configured) {
      const local = await saveFileLocally(file);
      return { key: local.key, downloadUrl: local.url };
    }
    const key = generateKey(folder, file.originalname);
    return uploadToPrivateBucket(key, file.buffer, file.mimetype);
  },

  getPrivateUrl: async (key: string, expiresIn?: number) => {
    if (!isR2Configured) {
      const port = config.port || 5000;
      return `http://localhost:${port}/uploads/${key}`;
    }
    return getPresignedUrl(key, expiresIn);
  },

  deleteFile: async (key: string) => {
    // REVERT_MARKER: Remove this dev workaround when dummy files are no longer used.
    if (key.startsWith("http") || key.includes("dummy-")) {
      return;
    }
    if (!isR2Configured) {
      const filePath = path.join(process.cwd(), "uploads", key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      return;
    }
    return deleteObject(key);
  },

  deletePublicFile: async (key: string) => {
    // REVERT_MARKER: Remove this dev workaround when dummy files are no longer used.
    if (key.startsWith("http") || key.includes("dummy-")) {
      return;
    }
    if (!isR2Configured) {
      const filePath = path.join(process.cwd(), "uploads", key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      return;
    }
    return deleteFromPublicBucket(key);
  },

  extractKey: (url: string): string => {
    // REVERT_MARKER: Remove this dev workaround when dummy files are no longer used.
    if (url.startsWith("http") && !url.includes("/uploads/") && (!config.r2.public_url || !url.includes(config.r2.public_url))) {
      return url;
    }
    if (!isR2Configured) {
      const parts = url.split("/uploads/");
      return parts.length > 1 ? parts[1] || "" : url;
    }
    const prefix = `${config.r2.public_url}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : url;
  },
};

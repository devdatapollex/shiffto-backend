export const PHOTO_UPLOAD = {
  ALLOWED_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ],
  MAX_SIZE: 5 * 1024 * 1024,
  MAX_FILES: 10,
  FOLDER: "shipments/photos",
};

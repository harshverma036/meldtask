import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import { randomUUID } from "crypto";
import { extname, join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Multer configuration for task asset file uploads.
 * Files are stored on local disk in the `uploads/` directory.
 * For production, swap storage to S3/Cloudflare R2.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOAD_DIR = join(__dirname, "..", "..", "uploads");

/** Maps common MIME types to file extensions for validation */
const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Text
  "text/plain",
  "text/csv",
  "text/html",
  "application/json",
  // Archives
  "application/zip",
  "application/x-rar-compressed",
  "application/gzip",
  // Code
  "application/javascript",
  "text/javascript",
  "application/xml",
  // Media
  "audio/mpeg",
  "audio/wav",
  "video/mp4",
  "video/webm",
]);

/** Maximum file size: 25 MB */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${randomUUID()}${extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type "${file.mimetype}" is not allowed`));
  }
};

/**
 * Configured multer instance for single file uploads.
 * Usage: `upload.single("file")` in route handlers.
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

export { UPLOAD_DIR };

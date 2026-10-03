import multer from "multer";

import { assertStorageConfigured } from "../utils/uploads.js";
import { MAX_UPLOAD_BYTES } from "../utils/uploadValidation.js";

export function requireStorageConfigured(req, res, next) {
  assertStorageConfigured();
  next();
}

export const singleFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  // Preserve the untrusted client path so validation can reject it explicitly
  // instead of Busboy silently reducing it to a basename first.
  preservePath: true,
}).single("file");

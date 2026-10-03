import { ApiError } from "../utils/ApiError.js";
import { logStructuredError, summarizeError } from "../utils/logger.js";

export function notFoundHandler(req, res) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  if (err?.name === "ZodError") {
    return res.status(400).json({ error: "Validation failed", details: err.issues });
  }

  if (err?.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File exceeds the 25 MiB upload limit" });
    }
    return res.status(400).json({ error: "Invalid file upload" });
  }

  logStructuredError("http.unhandled_error", { error: summarizeError(err) });
  res.status(500).json({ error: "Internal server error" });
}

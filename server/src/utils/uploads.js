import path from "path";
import fs from "fs";
import crypto from "crypto";

export const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

export function workspaceUploadDir(workspaceId) {
  const dir = path.join(UPLOADS_ROOT, workspaceId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Filenames on disk are always generated, never derived from user input,
// so there's no path-traversal surface from originalName.
export function generateStoredName(originalName) {
  const ext = path.extname(originalName).slice(0, 20);
  return `${crypto.randomUUID()}${ext}`;
}

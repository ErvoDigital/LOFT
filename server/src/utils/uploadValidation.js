import path from "path";
import { TextDecoder } from "util";
import JSZip from "jszip";

import { ApiError } from "./ApiError.js";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const TYPES = new Map([
  [".pdf", new Set(["application/pdf"])],
  [".txt", new Set(["text/plain"])],
  [".md", new Set(["text/markdown", "text/plain"])],
  [".csv", new Set(["text/csv", "text/plain"])],
  [".docx", new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"])],
  [".xlsx", new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])],
  [".pptx", new Set(["application/vnd.openxmlformats-officedocument.presentationml.presentation"])],
  [".jpg", new Set(["image/jpeg"])],
  [".jpeg", new Set(["image/jpeg"])],
  [".png", new Set(["image/png"])],
  [".gif", new Set(["image/gif"])],
  [".webp", new Set(["image/webp"])],
]);

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/u;
const PATH_SEPARATORS = /[\/\\\u2044\u2215\u29F8\uFF0F\uFF3C]/u;
const ENCODED_PATH_SEPARATOR = /%(?:25)*(?:2f|5c)/iu;

export function normalizeUploadFilename(value) {
  if (typeof value !== "string") throw new ApiError(400, "Invalid filename");
  const normalized = value.normalize("NFC").trim();
  const compatibilityForm = normalized.normalize("NFKC");
  if (
    !normalized ||
    PATH_SEPARATORS.test(normalized) ||
    PATH_SEPARATORS.test(compatibilityForm) ||
    ENCODED_PATH_SEPARATOR.test(normalized) ||
    CONTROL_CHARACTERS.test(normalized)
  ) {
    throw new ApiError(400, "Invalid filename");
  }
  const basename = path.basename(normalized);
  if (!basename || Buffer.byteLength(basename, "utf8") > 255) {
    throw new ApiError(400, "Filename must be at most 255 UTF-8 bytes");
  }
  return basename;
}

function startsWith(buffer, bytes) {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
}

function isUtf8Text(buffer) {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return text.includes("\0") ? null : text;
  } catch {
    return null;
  }
}

function looksLikeActiveContent(text) {
  const source = text.replace(/^\uFEFF/u, "").trimStart();
  return (
    /^<!doctype\s+html\b/iu.test(source) ||
    /<\/?[a-z][^>]*>/iu.test(source) ||
    /^#!.*\bnode\b/iu.test(source) ||
    /=>|\b(?:eval|Function|setTimeout|setInterval|fetch|alert|require)\s*\(/u.test(source) ||
    /^(?:import\s.+\sfrom\s|export\s+(?:default\s+)?|(?:const|let|var)\s+[\w$]+\s*=|(?:async\s+)?function\s+[\w$]+\s*\(|class\s+[\w$]+\s*[{]|(?:window|document|console)\.)/mu.test(source)
  );
}

const OOXML = {
  ".docx": {
    entry: "word/document.xml",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
  },
  ".xlsx": {
    entry: "xl/workbook.xml",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  },
  ".pptx": {
    entry: "ppt/presentation.xml",
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
  },
};

async function hasOoxmlSignature(buffer, extension) {
  if (!startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) return false;
  try {
    const zip = await JSZip.loadAsync(buffer, { checkCRC32: true, createFolders: false });
    const expected = OOXML[extension];
    const contentTypesEntry = zip.file("[Content_Types].xml");
    const relationshipsEntry = zip.file("_rels/.rels");
    if (!expected || !contentTypesEntry || !relationshipsEntry || !zip.file(expected.entry)) return false;
    const [contentTypes, relationships] = await Promise.all([
      contentTypesEntry.async("string"),
      relationshipsEntry.async("string"),
    ]);
    const hasContentType = (contentTypes.match(/<Override\b[^>]*>/giu) || []).some(
      (override) =>
        new RegExp(`\\bPartName\\s*=\\s*["']/${expected.entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "iu").test(override) &&
        new RegExp(`\\bContentType\\s*=\\s*["']${expected.contentType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "iu").test(override)
    );
    const hasOfficeDocumentRelationship = (relationships.match(/<Relationship\b[^>]*>/giu) || []).some(
      (relationship) =>
        /\bType\s*=\s*["'][^"']*\/officeDocument["']/iu.test(relationship) &&
        new RegExp(`\\bTarget\\s*=\\s*["']/?${expected.entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "iu").test(relationship)
    );
    return hasContentType && hasOfficeDocumentRelationship;
  } catch {
    return false;
  }
}

async function signatureMatches(extension, buffer) {
  switch (extension) {
    case ".pdf":
      return startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case ".txt":
    case ".md":
    case ".csv": {
      const text = isUtf8Text(buffer);
      return text !== null && !looksLikeActiveContent(text);
    }
    case ".docx":
    case ".xlsx":
    case ".pptx":
      return hasOoxmlSignature(buffer, extension);
    case ".jpg":
    case ".jpeg":
      return startsWith(buffer, [0xff, 0xd8, 0xff]);
    case ".png":
      return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case ".gif":
      return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
    case ".webp":
      return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    default:
      return false;
  }
}

export async function validateUploadedFile(file) {
  if (!file) throw new ApiError(400, "No file uploaded");
  if (!file.size || !file.buffer?.length) throw new ApiError(400, "Empty files are not allowed");
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "File exceeds the 25 MiB upload limit");

  const originalName = normalizeUploadFilename(file.originalname);
  const extension = path.extname(originalName).toLowerCase();
  const allowedMimes = TYPES.get(extension);
  if (!allowedMimes || !allowedMimes.has(String(file.mimetype || "").toLowerCase())) {
    throw new ApiError(415, "File type is not allowed");
  }
  if (!(await signatureMatches(extension, file.buffer))) {
    throw new ApiError(415, "File content does not match its declared type");
  }

  return { originalName, extension, mimeType: file.mimetype.toLowerCase() };
}

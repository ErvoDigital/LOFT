import crypto from "crypto";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ApiError } from "./ApiError.js";

export const ASSETS_BUCKET = process.env.AWS_S3_BUCKET || "loft-assets";

export function isStorageConfigured() {
  return Boolean(
    process.env.AWS_REGION?.trim() &&
    process.env.AWS_ENDPOINT_URL_S3?.trim() &&
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
    process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );
}

export function assertStorageConfigured() {
  if (!isStorageConfigured()) {
    throw new ApiError(503, "Object storage is not configured");
  }
}

let s3Client = null;

function getS3Client() {
  assertStorageConfigured();
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION.trim(),
      endpoint: process.env.AWS_ENDPOINT_URL_S3.trim(),
      forcePathStyle: true, // required: Neon Object Storage uses path-style addressing
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
      },
    });
  }
  return s3Client;
}

// Filenames on disk/in the bucket are always generated, never derived from
// user input, so there's no path-traversal surface from originalName.
export function generateStoredName(originalName) {
  const ext = path.extname(originalName).slice(0, 20);
  return `${crypto.randomUUID()}${ext}`;
}

function objectKey(workspaceId, storedName) {
  return `${workspaceId}/${storedName}`;
}

export async function uploadObject(workspaceId, storedName, buffer, mimeType) {
  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: ASSETS_BUCKET,
      Key: objectKey(workspaceId, storedName),
      Body: buffer,
      ContentType: mimeType,
    })
  );
}

export async function deleteObject(workspaceId, storedName) {
  if (!isStorageConfigured()) return;
  try {
    const s3 = getS3Client();
    await s3.send(
      new DeleteObjectCommand({ Bucket: ASSETS_BUCKET, Key: objectKey(workspaceId, storedName) })
    );
  } catch {
    // Best-effort cleanup — ignore errors if deletion fails
  }
}

export async function presignDownloadUrl(workspaceId, storedName, originalName) {
  const s3 = getS3Client();
  const command = new GetObjectCommand({
    Bucket: ASSETS_BUCKET,
    Key: objectKey(workspaceId, storedName),
    ResponseContentDisposition: `attachment; filename="${originalName.replace(/"/g, "")}"`,
  });
  return getSignedUrl(s3, command, { expiresIn: 300 });
}

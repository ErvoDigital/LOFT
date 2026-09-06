import crypto from "crypto";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const ASSETS_BUCKET = "loft-assets";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  forcePathStyle: true, // required: Neon Object Storage uses path-style addressing
});

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
  await s3.send(
    new DeleteObjectCommand({ Bucket: ASSETS_BUCKET, Key: objectKey(workspaceId, storedName) })
  ).catch(() => {});
}

export async function presignDownloadUrl(workspaceId, storedName, originalName) {
  const command = new GetObjectCommand({
    Bucket: ASSETS_BUCKET,
    Key: objectKey(workspaceId, storedName),
    ResponseContentDisposition: `attachment; filename="${originalName.replace(/"/g, "")}"`,
  });
  return getSignedUrl(s3, command, { expiresIn: 300 });
}

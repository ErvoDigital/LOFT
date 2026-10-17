import crypto from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, ListPartsCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ApiError } from "./ApiError.js";

export function isStorageConfigured() {
  return Boolean(
    process.env.AWS_REGION?.trim() &&
    process.env.AWS_S3_BUCKET?.trim() &&
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
let downloadSigner = getSignedUrl;

function storageConfig() {
  return {
    region: process.env.AWS_REGION.trim(),
    bucket: process.env.AWS_S3_BUCKET.trim(),
    endpoint: process.env.AWS_ENDPOINT_URL_S3?.trim() || undefined,
  };
}

function getS3Client() {
  assertStorageConfigured();
  if (!s3Client) {
    const config = storageConfig();
    s3Client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
      },
    });
  }
  return s3Client;
}

// Physical names are entirely server-generated. Original names and extensions
// remain database metadata and never become part of an object key.
export function generateStoredName() {
  return crypto.randomUUID();
}

function multipartInput(session) {
  assertStorageConfigured();
  return { Bucket: storageConfig().bucket, Key: objectKey(session.workspaceId, session.storageKey), UploadId: session.uploadId };
}
export async function beginMultipart(workspaceId, storedName, mimeType) {
  assertStorageConfigured();
  const result = await getS3Client().send(new CreateMultipartUploadCommand({ Bucket: storageConfig().bucket, Key: objectKey(workspaceId, storedName), ContentType: mimeType }));
  return result.UploadId;
}
export async function signMultipartPart(session, number) {
  return getSignedUrl(getS3Client(), new UploadPartCommand({ ...multipartInput(session), PartNumber: number }), { expiresIn: 900 });
}
export async function multipartParts(session) {
  const result = await getS3Client().send(new ListPartsCommand(multipartInput(session)));
  return (result.Parts || []).map((part) => ({ number: part.PartNumber, etag: part.ETag, size: part.Size }));
}
export async function finishMultipart(session, parts) {
  try {
    await getS3Client().send(new CompleteMultipartUploadCommand({ ...multipartInput(session), MultipartUpload: { Parts: parts.map((part) => ({ PartNumber: part.number, ETag: part.etag })) } }));
  } catch (error) {
    // A successful completion whose HTTP response was lost has no upload ID
    // left. The server-generated object key makes checking that case safe.
    const head = await getS3Client().send(new HeadObjectCommand({ Bucket: storageConfig().bucket, Key: objectKey(session.workspaceId, session.storageKey) })).catch(() => null);
    if (head?.ContentLength !== session.size) throw error;
  }
}
export async function readMultipartObject(session) {
  const result = await getS3Client().send(new GetObjectCommand({ Bucket: storageConfig().bucket, Key: objectKey(session.workspaceId, session.storageKey) }));
  if (result.ContentLength !== session.size) throw new ApiError(400, "Uploaded file size does not match");
  return Buffer.from(await result.Body.transformToByteArray());
}
export async function abortMultipart(session) {
  await getS3Client().send(new AbortMultipartUploadCommand(multipartInput(session)));
}

function objectKey(workspaceId, storedName) {
  return `${workspaceId}/${storedName}`;
}

export async function uploadObject(workspaceId, storedName, buffer, mimeType) {
  const s3 = getS3Client();
  const { bucket } = storageConfig();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey(workspaceId, storedName),
      Body: buffer,
      ContentType: mimeType,
    })
  );
}

export async function copyObject(workspaceId, source, target) {
  assertStorageConfigured();
  const { bucket } = storageConfig();
  await getS3Client().send(new CopyObjectCommand({ Bucket: bucket, CopySource: `${bucket}/${objectKey(workspaceId, source)}`, Key: objectKey(workspaceId, target) }));
}

export async function deleteObject(workspaceId, storedName) {
  assertStorageConfigured();
  try {
    const s3 = getS3Client();
    const { bucket } = storageConfig();
    await s3.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: objectKey(workspaceId, storedName) })
    );
  } catch (err) {
    if (err?.name === "NotFound" || err?.name === "NoSuchKey") return;
    const deleteError = new ApiError(502, "Failed to delete stored object");
    deleteError.code = "STORAGE_DELETE_FAILED";
    throw deleteError;
  }
}

export async function presignDownloadUrl(workspaceId, storedName, originalName) {
  const s3 = getS3Client();
  const { bucket } = storageConfig();
  const fallbackName = originalName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "download";
  const encodedName = encodeURIComponent(originalName).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey(workspaceId, storedName),
    ResponseContentDisposition: `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`,
  });
  return downloadSigner(s3, command, { expiresIn: 300 });
}

// Narrow injection points keep unit/integration tests fully offline.
export function setS3ClientForTests(client) {
  s3Client = client;
}

export function setDownloadSignerForTests(signer) {
  downloadSigner = signer;
}

export function resetStorageForTests() {
  s3Client = null;
  downloadSigner = getSignedUrl;
}

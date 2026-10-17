import { z } from "zod";
import { createHash } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { can } from "../services/permissions.js";
import { isFolderVisible, resolveFolderAncestry } from "../services/folderAccess.js";
import { assetInclude, serialize, assertAssetFolderAccess } from "./assets.controller.js";
import { validateUploadedFile, validateUploadMetadata } from "../utils/uploadValidation.js";
import { generateStoredName, beginMultipart, signMultipartPart, multipartParts, finishMultipart, readMultipartObject, abortMultipart, deleteObject } from "../utils/uploads.js";
import { serializable } from "../services/taskCollaboration.js";
import { emitToWorkspace } from "../sockets/io.js";

const PART_SIZE = 5 * 1024 * 1024;
async function destination(req, session) {
  if (session.assetId) {
    const asset = await prisma.asset.findUnique({ where: { id: session.assetId } });
    if (!asset || asset.workspaceId !== req.params.workspaceId) throw new ApiError(404, "File not found");
    await assertAssetFolderAccess(req, asset);
    if (asset.uploadedById !== req.userId && !can(req.membership, "files.manage")) throw new ApiError(403, "You cannot add versions to this file");
    return;
  }
  if (session.folderId) {
    const folders = await prisma.folder.findMany({ where: { workspaceId: req.params.workspaceId }, include: { members: true } });
    const map = new Map(folders.map((folder) => [folder.id, folder])), folder = map.get(session.folderId);
    if (!folder) throw new ApiError(404, "Folder not found");
    const ancestry = resolveFolderAncestry(folder, map);
    if (!ancestry || ancestry.some((parent) => parent.chatConversationId)) throw new ApiError(400, "Choose an ordinary storage folder");
    if (!isFolderVisible(req.userId, req.membership, folder, map)) throw new ApiError(403, "Folder is not accessible");
  }
}
async function sessionFor(req) {
  const session = await prisma.uploadSession.findUnique({ where: { id: req.params.uploadId } });
  if (!session || session.userId !== req.userId || session.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Upload not found");
  if (session.expiresAt < new Date()) throw new ApiError(410, "Upload expired. Select the file to start again.");
  await destination(req, session);
  return session;
}
export async function begin(req, res) {
  const data = z.object({ name: z.string(), mimeType: z.string(), size: z.number().int(), checksum: z.string().regex(/^[a-f0-9]{64}$/), folderId: z.string().nullable().optional(), assetId: z.string().optional() }).strict().parse(req.body);
  const metadata = validateUploadMetadata(data.name, data.mimeType, data.size);
  await destination(req, data);
  const count = await prisma.uploadSession.count({ where: { userId: req.userId, expiresAt: { gt: new Date() }, completedAssetId: null } });
  if (count >= 10) throw new ApiError(429, "Finish or cancel an existing upload first");
  const storageKey = generateStoredName(), uploadId = await beginMultipart(req.params.workspaceId, storageKey, metadata.mimeType);
  let session;
  try { session = await prisma.uploadSession.create({ data: { ...data, name: metadata.originalName, mimeType: metadata.mimeType, workspaceId: req.params.workspaceId, userId: req.userId, storageKey, uploadId, partSize: PART_SIZE, expiresAt: new Date(Date.now() + 86400000) } }); }
  catch (error) { await abortMultipart({ workspaceId: req.params.workspaceId, storageKey, uploadId }); throw error; }
  res.status(201).json({ id: session.id, partSize: PART_SIZE, parts: [] });
}
export async function status(req, res) {
  const session = await sessionFor(req);
  res.json({ id: session.id, partSize: session.partSize, completedAssetId: session.completedAssetId, objectCompleted: session.objectCompleted, parts: session.objectCompleted || session.completedAssetId ? [] : await multipartParts(session) });
}
export async function partUrl(req, res) {
  const session = await sessionFor(req), number = z.coerce.number().int().min(1).max(Math.ceil(session.size / session.partSize)).parse(req.params.partNumber);
  if (session.objectCompleted || session.completedAssetId) throw new ApiError(409, "This upload is already complete");
  res.json({ url: await signMultipartPart(session, number) });
}
export async function complete(req, res) {
  let session = await sessionFor(req);
  if (session.completedAssetId) {
    const asset = await prisma.asset.findUnique({ where: { id: session.completedAssetId }, include: assetInclude });
    if (!asset) throw new ApiError(404, "Completed file was removed");
    return res.json({ asset: serialize(asset) });
  }
  if (!session.objectCompleted) {
    let parts;
    try { parts = await multipartParts(session); }
    catch (error) { if (error.name !== "NoSuchUpload") throw error; parts = []; }
    if (parts.length && (parts.length !== Math.ceil(session.size / session.partSize) || parts.some((part, index) => part.number !== index + 1 || part.size !== Math.min(session.partSize, session.size - index * session.partSize)))) throw new ApiError(400, "Upload is incomplete or a part has the wrong size");
    await finishMultipart(session, parts);
    session = await prisma.uploadSession.update({ where: { id: session.id }, data: { objectCompleted: true } });
  }
  const buffer = await readMultipartObject(session);
  try {
    await validateUploadedFile({ originalname: session.name, mimetype: session.mimeType, size: buffer.length, buffer });
    if (createHash("sha256").update(buffer).digest("hex") !== session.checksum) throw new ApiError(400, "The uploaded file does not match the selected file");
  } catch (error) { await deleteObject(session.workspaceId, session.storageKey); await prisma.uploadSession.delete({ where: { id: session.id } }); throw error; }
  const asset = await serializable(prisma, async (tx) => {
    const current = await tx.uploadSession.findUnique({ where: { id: session.id } });
    if (current.completedAssetId) return tx.asset.findUnique({ where: { id: current.completedAssetId }, include: assetInclude });
    const version = { storedName: session.storageKey, originalName: session.name, mimeType: session.mimeType, size: session.size, uploadedById: req.userId };
    let result;
    if (session.assetId) {
      const latest = await tx.assetVersion.findFirst({ where: { assetId: session.assetId }, orderBy: { version: "desc" } });
      await tx.assetVersion.create({ data: { ...version, assetId: session.assetId, version: latest.version + 1 } });
      result = await tx.asset.update({ where: { id: session.assetId }, data: { updatedAt: new Date() }, include: assetInclude });
    } else result = await tx.asset.create({ data: { workspaceId: session.workspaceId, folderId: session.folderId, name: session.name, uploadedById: req.userId, versions: { create: { ...version, version: 1 } } }, include: assetInclude });
    await tx.uploadSession.update({ where: { id: session.id }, data: { completedAssetId: result.id } });
    return result;
  });
  emitToWorkspace(session.workspaceId, session.assetId ? "asset:updated" : "asset:created", serialize(asset));
  res.json({ asset: serialize(asset) });
}
export async function cancel(req, res) {
  const session = await sessionFor(req);
  if (!session.completedAssetId) { if (session.objectCompleted) await deleteObject(session.workspaceId, session.storageKey); else await abortMultipart(session); }
  await prisma.uploadSession.delete({ where: { id: session.id } });
  res.json({ message: "Upload cancelled" });
}

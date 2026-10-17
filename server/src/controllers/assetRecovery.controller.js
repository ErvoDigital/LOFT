import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { can } from "../services/permissions.js";
import { assertAssetFolderAccess, assetInclude, serialize, deleteAsset } from "./assets.controller.js";
import { emitToWorkspace } from "../sockets/io.js";
import { serializable } from "../services/taskCollaboration.js";
import { generateStoredName, copyObject, deleteObject } from "../utils/uploads.js";

async function managedAsset(req, allowDeleted = false) {
  const asset = await prisma.asset.findUnique({ where: { id: req.params.assetId }, include: assetInclude });
  if (!asset || asset.workspaceId !== req.params.workspaceId || (req.params.taskId && asset.taskId !== req.params.taskId)) throw new ApiError(404, "File not found");
  await assertAssetFolderAccess({ ...req, allowDeletedAsset: allowDeleted }, asset);
  if (asset.uploadedById !== req.userId && !can(req.membership, "files.manage")) throw new ApiError(403, "You cannot manage this file");
  return asset;
}
export async function trashAsset(req, res) {
  const asset = await managedAsset(req);
  await prisma.asset.update({ where: { id: asset.id }, data: { deletedAt: new Date() } });
  emitToWorkspace(asset.workspaceId, "asset:deleted", { id: asset.id });
  res.json({ message: "File moved to recycle bin" });
}
export async function listTrash(req, res) {
  const assets = await prisma.asset.findMany({ where: { workspaceId: req.params.workspaceId, deletedAt: { not: null }, ...(can(req.membership, "files.manage") ? {} : { uploadedById: req.userId }) }, include: assetInclude, orderBy: { deletedAt: "desc" }, take: 100 });
  const visible = [];
  for (const asset of assets) { try { await assertAssetFolderAccess({ ...req, allowDeletedAsset: true }, asset); visible.push(serialize(asset)); } catch (error) { if (error.statusCode !== 403) throw error; } }
  res.json({ assets: visible });
}
export async function restoreAsset(req, res) {
  const asset = await managedAsset(req, true);
  const restored = await prisma.asset.update({ where: { id: asset.id }, data: { deletedAt: null }, include: assetInclude });
  emitToWorkspace(asset.workspaceId, "asset:created", serialize(restored));
  res.json({ asset: serialize(restored) });
}
export async function purgeAsset(req, res) {
  const asset = await managedAsset(req, true);
  if (!asset.deletedAt) throw new ApiError(400, "Move this file to the recycle bin first");
  return deleteAsset({ ...req, allowDeletedAsset: true }, res);
}
export async function restoreVersion(req, res) {
  const asset = await managedAsset(req);
  const version = asset.versions.find((item) => item.id === req.params.versionId);
  if (!version) throw new ApiError(404, "Version not found");
  const storedName = generateStoredName();
  await copyObject(asset.workspaceId, version.storedName, storedName);
  let restored;
  try {
    restored = await serializable(prisma, async (tx) => {
      const latest = await tx.assetVersion.findFirst({ where: { assetId: asset.id }, orderBy: { version: "desc" } });
      await tx.assetVersion.create({ data: { assetId: asset.id, version: latest.version + 1, storedName, originalName: version.originalName, mimeType: version.mimeType, size: version.size, uploadedById: req.userId } });
      return tx.asset.update({ where: { id: asset.id }, data: { updatedAt: new Date() }, include: assetInclude });
    });
  } catch (error) { await deleteObject(asset.workspaceId, storedName); throw error; }
  emitToWorkspace(asset.workspaceId, "asset:updated", serialize(restored));
  res.json({ asset: serialize(restored) });
}

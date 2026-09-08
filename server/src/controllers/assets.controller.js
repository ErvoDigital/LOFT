import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { generateStoredName, uploadObject, deleteObject, presignDownloadUrl } from "../utils/uploads.js";
import { emitToWorkspace } from "../sockets/io.js";
import { isFolderVisible } from "../services/folderAccess.js";
import { folderInclude, serializeFolder } from "./folders.controller.js";

function serialize(asset) {
  const versions = [...asset.versions].sort((a, b) => b.version - a.version);
  return {
    id: asset.id,
    workspaceId: asset.workspaceId,
    folderId: asset.folderId,
    name: asset.name,
    uploadedBy: asset.uploadedBy,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    latestVersion: versions[0],
    versionCount: versions.length,
    versions,
  };
}

const assetInclude = {
  uploadedBy: { select: { id: true, name: true, avatarColor: true } },
  versions: {
    orderBy: { version: "desc" },
    include: { uploadedBy: { select: { id: true, name: true, avatarColor: true } } },
  },
};

// Fetches the folder an asset belongs to (with members, for isFolderVisible)
// and throws if the caller can't act on it — used before any read/write on
// an existing asset so folder restriction can't be bypassed by id-guessing.
async function assertAssetFolderAccess(req, asset) {
  if (!asset.folderId) return;
  const folder = await prisma.folder.findUnique({ where: { id: asset.folderId }, include: { members: true } });
  if (!isFolderVisible(req.userId, req.membership.role, folder)) {
    throw new ApiError(403, "You don't have access to this file");
  }
}

export async function listAssets(req, res) {
  const workspaceId = req.params.workspaceId;
  const [assets, folders] = await Promise.all([
    prisma.asset.findMany({ where: { workspaceId }, include: assetInclude, orderBy: { updatedAt: "desc" } }),
    prisma.folder.findMany({ where: { workspaceId }, include: { members: true } }),
  ]);
  const folderById = new Map(folders.map((f) => [f.id, f]));
  const visible = assets.filter(
    (a) => !a.folderId || isFolderVisible(req.userId, req.membership.role, folderById.get(a.folderId))
  );
  res.json({ assets: visible.map(serialize) });
}

export async function uploadAsset(req, res) {
  if (!req.file) throw new ApiError(400, "No file uploaded");
  const workspaceId = req.params.workspaceId;
  const name = (req.body.name || req.file.originalname).slice(0, 160);
  const folderId = req.body.folderId || null;

  if (folderId) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId }, include: { members: true } });
    if (!folder || folder.workspaceId !== workspaceId) throw new ApiError(404, "Folder not found");
    if (!isFolderVisible(req.userId, req.membership.role, folder)) {
      throw new ApiError(403, "You don't have access to this folder");
    }
  }

  const storedName = generateStoredName(req.file.originalname);
  await uploadObject(workspaceId, storedName, req.file.buffer, req.file.mimetype);

  const asset = await prisma.asset.create({
    data: {
      workspaceId,
      folderId,
      name,
      uploadedById: req.userId,
      versions: {
        create: {
          version: 1,
          originalName: req.file.originalname,
          storedName,
          mimeType: req.file.mimetype,
          size: req.file.size,
          uploadedById: req.userId,
        },
      },
    },
    include: assetInclude,
  });

  emitToWorkspace(workspaceId, "asset:created", serialize(asset));
  res.status(201).json({ asset: serialize(asset) });
}

// Finds (or creates) the one folder that holds every file shared in a given
// conversation's chat. The default "General" channel's folder stays
// WORKSPACE-visible like the channel itself; a smaller, hand-picked channel
// gets a RESTRICTED folder seeded with that channel's own participants, so
// its shared files don't leak into workspace-wide Storage for members who
// were never in the channel. `chatConversationId` is unique, so a race
// between two first-ever uploads in the same conversation is resolved by
// letting the loser's insert fail and re-reading the winner's row.
async function getOrCreateChatFolder(conversation, userId) {
  const existing = await prisma.folder.findUnique({ where: { chatConversationId: conversation.id } });
  if (existing) return existing;

  const isPickedChannel = conversation.isGroup && !conversation.isDefault;
  try {
    const folder = await prisma.folder.create({
      data: {
        workspaceId: conversation.workspaceId,
        name: conversation.isDefault ? "Chat files" : `${conversation.title} (chat files)`,
        visibility: isPickedChannel ? "RESTRICTED" : "WORKSPACE",
        createdById: userId,
        chatConversationId: conversation.id,
        members: isPickedChannel
          ? {
              create: (
                await prisma.conversationParticipant.findMany({ where: { conversationId: conversation.id } })
              ).map((p) => ({ userId: p.userId })),
            }
          : undefined,
      },
      include: folderInclude,
    });
    emitToWorkspace(conversation.workspaceId, "folder:created", serializeFolder(folder));
    return folder;
  } catch (err) {
    if (err.code === "P2002") return prisma.folder.findUnique({ where: { chatConversationId: conversation.id } });
    throw err;
  }
}

// A file attached to a chat message. Unlike uploadAsset, the destination
// folder isn't caller-chosen — it's always that conversation's own chat
// folder, resolved server-side — so this doubles as the permission check for
// "can this user share files in this conversation" (only participants get a
// folder for it in the first place).
export async function uploadChatAttachment(req, res) {
  if (!req.file) throw new ApiError(400, "No file uploaded");
  const workspaceId = req.params.workspaceId;
  const { conversationId } = req.body;
  if (!conversationId) throw new ApiError(400, "conversationId is required");

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.workspaceId !== workspaceId) throw new ApiError(404, "Conversation not found");

  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: req.userId } },
  });
  if (!participant) throw new ApiError(403, "You are not part of this conversation");

  const folder = await getOrCreateChatFolder(conversation, req.userId);

  const name = (req.body.name || req.file.originalname).slice(0, 160);
  const storedName = generateStoredName(req.file.originalname);
  await uploadObject(workspaceId, storedName, req.file.buffer, req.file.mimetype);

  const asset = await prisma.asset.create({
    data: {
      workspaceId,
      folderId: folder.id,
      name,
      uploadedById: req.userId,
      versions: {
        create: {
          version: 1,
          originalName: req.file.originalname,
          storedName,
          mimeType: req.file.mimetype,
          size: req.file.size,
          uploadedById: req.userId,
        },
      },
    },
    include: assetInclude,
  });

  emitToWorkspace(workspaceId, "asset:created", serialize(asset));
  res.status(201).json({ asset: serialize(asset) });
}

// Adds a new version directly to an existing asset — used when a file is
// dropped from the OS straight onto an existing card.
export async function uploadVersion(req, res) {
  if (!req.file) throw new ApiError(400, "No file uploaded");
  const { workspaceId, assetId } = req.params;

  const existing = await prisma.asset.findUnique({ where: { id: assetId }, include: { versions: true } });
  if (!existing || existing.workspaceId !== workspaceId) throw new ApiError(404, "Asset not found");
  await assertAssetFolderAccess(req, existing);

  const nextVersion = Math.max(0, ...existing.versions.map((v) => v.version)) + 1;
  const storedName = generateStoredName(req.file.originalname);
  await uploadObject(workspaceId, storedName, req.file.buffer, req.file.mimetype);
  await prisma.assetVersion.create({
    data: {
      assetId,
      version: nextVersion,
      originalName: req.file.originalname,
      storedName,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedById: req.userId,
    },
  });
  await prisma.asset.update({ where: { id: assetId }, data: { updatedAt: new Date() } });

  const asset = await prisma.asset.findUnique({ where: { id: assetId }, include: assetInclude });
  emitToWorkspace(workspaceId, "asset:updated", serialize(asset));
  res.status(201).json({ asset: serialize(asset) });
}

const mergeSchema = z.object({ sourceAssetId: z.string().min(1) });

// Merges a second upload into an existing entry as its next version —
// the "drag the new file onto the existing one" interaction.
export async function mergeAssets(req, res) {
  const { sourceAssetId } = mergeSchema.parse(req.body);
  const { workspaceId, assetId: targetAssetId } = req.params;

  if (sourceAssetId === targetAssetId) throw new ApiError(400, "Cannot merge an asset into itself");

  const [target, source] = await Promise.all([
    prisma.asset.findUnique({ where: { id: targetAssetId }, include: { versions: true } }),
    prisma.asset.findUnique({ where: { id: sourceAssetId }, include: { versions: true } }),
  ]);
  if (!target || target.workspaceId !== workspaceId) throw new ApiError(404, "Target asset not found");
  if (!source || source.workspaceId !== workspaceId) throw new ApiError(404, "Source asset not found");
  await Promise.all([assertAssetFolderAccess(req, target), assertAssetFolderAccess(req, source)]);

  let nextVersion = Math.max(0, ...target.versions.map((v) => v.version)) + 1;
  const sourceVersionsAsc = [...source.versions].sort((a, b) => a.version - b.version);

  await prisma.$transaction(
    sourceVersionsAsc.map((v) =>
      prisma.assetVersion.update({
        where: { id: v.id },
        data: { assetId: targetAssetId, version: nextVersion++ },
      })
    )
  );
  await prisma.asset.delete({ where: { id: sourceAssetId } });
  await prisma.asset.update({ where: { id: targetAssetId }, data: { updatedAt: new Date() } });

  const merged = await prisma.asset.findUnique({ where: { id: targetAssetId }, include: assetInclude });
  emitToWorkspace(workspaceId, "asset:merged", { mergedAssetId: sourceAssetId, asset: serialize(merged) });
  res.json({ asset: serialize(merged) });
}

export async function downloadVersion(req, res) {
  const { workspaceId, assetId, versionId } = req.params;
  const version = await prisma.assetVersion.findUnique({
    where: { id: versionId },
    include: { asset: true },
  });
  if (!version || version.assetId !== assetId || version.asset.workspaceId !== workspaceId) {
    throw new ApiError(404, "File not found");
  }
  await assertAssetFolderAccess(req, version.asset);

  const url = await presignDownloadUrl(workspaceId, version.storedName, version.originalName);
  res.redirect(url);
}

export async function deleteAsset(req, res) {
  const { workspaceId, assetId } = req.params;
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, include: { versions: true } });
  if (!asset || asset.workspaceId !== workspaceId) throw new ApiError(404, "Asset not found");
  if (asset.uploadedById !== req.userId && req.membership.role !== "ADMIN") {
    throw new ApiError(403, "You do not have permission to delete this file");
  }
  await assertAssetFolderAccess(req, asset);

  await Promise.all(asset.versions.map((v) => deleteObject(workspaceId, v.storedName)));
  await prisma.asset.delete({ where: { id: assetId } });

  emitToWorkspace(workspaceId, "asset:deleted", { id: assetId });
  res.json({ message: "Asset deleted" });
}

const moveSchema = z.object({ folderId: z.string().nullable() });

export async function moveAsset(req, res) {
  const { workspaceId, assetId } = req.params;
  const { folderId } = moveSchema.parse(req.body);

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset || asset.workspaceId !== workspaceId) throw new ApiError(404, "Asset not found");
  if (asset.uploadedById !== req.userId && req.membership.role !== "ADMIN") {
    throw new ApiError(403, "You do not have permission to move this file");
  }
  await assertAssetFolderAccess(req, asset);

  if (folderId) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId }, include: { members: true } });
    if (!folder || folder.workspaceId !== workspaceId) throw new ApiError(404, "Folder not found");
    if (!isFolderVisible(req.userId, req.membership.role, folder)) {
      throw new ApiError(403, "You don't have access to this folder");
    }
  }

  const updated = await prisma.asset.update({
    where: { id: assetId },
    data: { folderId, updatedAt: new Date() },
    include: assetInclude,
  });
  emitToWorkspace(workspaceId, "asset:updated", serialize(updated));
  res.json({ asset: serialize(updated) });
}

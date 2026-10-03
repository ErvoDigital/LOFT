import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { generateStoredName, uploadObject, presignDownloadUrl, assertStorageConfigured } from "../utils/uploads.js";
import { emitToWorkspace } from "../sockets/io.js";
import { isFolderVisible, resolveFolderAncestry } from "../services/folderAccess.js";
import { can } from "../services/permissions.js";
import { folderInclude, serializeFolder } from "./folders.controller.js";
import { validateUploadedFile } from "../utils/uploadValidation.js";
import { deleteStoredVersions } from "../services/assetStorage.js";

function serializeVersion(version) {
  return {
    id: version.id,
    version: version.version,
    originalName: version.originalName,
    mimeType: version.mimeType,
    size: version.size,
    uploadedBy: version.uploadedBy,
    createdAt: version.createdAt,
  };
}

function serialize(asset) {
  const versions = [...asset.versions].sort((a, b) => b.version - a.version);
  return {
    id: asset.id,
    workspaceId: asset.workspaceId,
    folderId: asset.folderId,
    taskId: asset.taskId,
    name: asset.name,
    uploadedBy: asset.uploadedBy,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    latestVersion: versions[0] ? serializeVersion(versions[0]) : null,
    versionCount: versions.length,
    versions: versions.map(serializeVersion),
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
async function loadFolderAccessMap(workspaceId) {
  const folders = await prisma.folder.findMany({ where: { workspaceId }, include: { members: true } });
  return new Map(folders.map((folder) => [folder.id, folder]));
}

async function assertAssetFolderAccess(req, asset, folderById = null) {
  if (!asset.folderId) return;
  const folders = folderById || (await loadFolderAccessMap(asset.workspaceId));
  const folder = folders.get(asset.folderId);
  if (!isFolderVisible(req.userId, req.membership, folder, folders)) {
    throw new ApiError(403, "You don't have access to this file");
  }
}

export async function listAssets(req, res) {
  const workspaceId = req.params.workspaceId;
  const [assets, folders] = await Promise.all([
    prisma.asset.findMany({ where: { workspaceId, taskId: null }, include: assetInclude, orderBy: { updatedAt: "desc" } }),
    prisma.folder.findMany({ where: { workspaceId }, include: { members: true } }),
  ]);
  const folderById = new Map(folders.map((f) => [f.id, f]));
  const visible = assets.filter(
    (a) => !a.folderId || isFolderVisible(req.userId, req.membership, folderById.get(a.folderId), folderById)
  );
  res.json({ assets: visible.map(serialize) });
}

export async function uploadAsset(req, res) {
  const file = await validateUploadedFile(req.file);
  const workspaceId = req.params.workspaceId;
  const name = (req.body.name || file.originalName).trim().slice(0, 160);
  const folderId = req.body.folderId || null;

  if (folderId) {
    const folderById = await loadFolderAccessMap(workspaceId);
    const folder = folderById.get(folderId);
    if (!folder) throw new ApiError(404, "Folder not found");
    const ancestry = resolveFolderAncestry(folder, folderById);
    if (!ancestry) throw new ApiError(400, "Destination folder hierarchy is invalid");
    if (!isFolderVisible(req.userId, req.membership, folder, folderById)) {
      throw new ApiError(403, "You don't have access to this folder");
    }
    if (ancestry.some((ancestor) => ancestor.chatConversationId)) {
      throw new ApiError(400, "Files cannot be uploaded through a managed chat folder");
    }
  }

  const storedName = generateStoredName();
  await uploadObject(workspaceId, storedName, req.file.buffer, file.mimeType);

  const asset = await prisma.asset.create({
    data: {
      workspaceId,
      folderId,
      name,
      uploadedById: req.userId,
      versions: {
        create: {
          version: 1,
          originalName: file.originalName,
          storedName,
          mimeType: file.mimeType,
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

// Files attached directly to a task (shown in its details panel). Unlike
// uploadAsset these skip Storage's folder system entirely — Asset.taskId is
// the only home a task attachment needs — so they never show up in the
// workspace's general file browser, only on the task itself.
export async function listTaskAttachments(req, res) {
  const { workspaceId, taskId } = req.params;
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.workspaceId !== workspaceId) throw new ApiError(404, "Task not found");

  const assets = await prisma.asset.findMany({ where: { taskId }, include: assetInclude, orderBy: { createdAt: "asc" } });
  res.json({ assets: assets.map(serialize) });
}

export async function uploadTaskAttachment(req, res) {
  const file = await validateUploadedFile(req.file);
  const { workspaceId, taskId } = req.params;
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.workspaceId !== workspaceId) throw new ApiError(404, "Task not found");

  const name = (req.body.name || file.originalName).trim().slice(0, 160);
  const storedName = generateStoredName();
  await uploadObject(workspaceId, storedName, req.file.buffer, file.mimeType);

  const asset = await prisma.asset.create({
    data: {
      workspaceId,
      taskId,
      name,
      uploadedById: req.userId,
      versions: {
        create: {
          version: 1,
          originalName: file.originalName,
          storedName,
          mimeType: file.mimeType,
          size: req.file.size,
          uploadedById: req.userId,
        },
      },
    },
    include: assetInclude,
  });

  emitToWorkspace(workspaceId, "task:attachment:created", { taskId, asset: serialize(asset) });
  res.status(201).json({ asset: serialize(asset) });
}

// A meeting's chat is thrown away with the meeting, but files shared in it
// aren't — they still land in Storage. Since every meeting gets its own
// conversation, they'd otherwise pile up as a stack of identically-named
// top-level folders, so meeting chat folders are named after when the
// meeting happened and tucked under one shared "Meeting files" parent.
function meetingFolderName(conversation) {
  const when = new Date(conversation.createdAt);
  return `Meeting · ${when.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

async function getOrCreateMeetingFilesFolder(conversation, userId) {
  const existing = await prisma.folder.findFirst({
    where: {
      workspaceId: conversation.workspaceId,
      name: "Meeting files",
      parentId: null,
      chatConversationId: null,
    },
  });
  if (existing) return existing;

  const folder = await prisma.folder.create({
    data: {
      workspaceId: conversation.workspaceId,
      name: "Meeting files",
      visibility: "WORKSPACE",
      createdById: userId,
    },
    include: folderInclude,
  });
  emitToWorkspace(conversation.workspaceId, "folder:created", serializeFolder(folder));
  return folder;
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
  const meetingParent = conversation.isMeetingChat ? await getOrCreateMeetingFilesFolder(conversation, userId) : null;
  try {
    const folder = await prisma.folder.create({
      data: {
        workspaceId: conversation.workspaceId,
        name: conversation.isMeetingChat
          ? meetingFolderName(conversation)
          : conversation.isDefault
          ? "Chat files"
          : `${conversation.title} (chat files)`,
        parentId: meetingParent?.id ?? null,
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
  const file = await validateUploadedFile(req.file);
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

  const name = (req.body.name || file.originalName).trim().slice(0, 160);
  const storedName = generateStoredName();
  await uploadObject(workspaceId, storedName, req.file.buffer, file.mimeType);

  const asset = await prisma.asset.create({
    data: {
      workspaceId,
      folderId: folder.id,
      name,
      uploadedById: req.userId,
      versions: {
        create: {
          version: 1,
          originalName: file.originalName,
          storedName,
          mimeType: file.mimeType,
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
  const { workspaceId, assetId } = req.params;

  const existing = await prisma.asset.findUnique({ where: { id: assetId }, include: { versions: true } });
  if (!existing || existing.workspaceId !== workspaceId) throw new ApiError(404, "Asset not found");
  await assertAssetFolderAccess(req, existing);
  if (existing.uploadedById !== req.userId && !can(req.membership, "files.manage")) {
    throw new ApiError(403, "You do not have permission to add a version to this file");
  }
  const file = await validateUploadedFile(req.file);

  const nextVersion = Math.max(0, ...existing.versions.map((v) => v.version)) + 1;
  const storedName = generateStoredName();
  await uploadObject(workspaceId, storedName, req.file.buffer, file.mimeType);
  await prisma.assetVersion.create({
    data: {
      assetId,
      version: nextVersion,
      originalName: file.originalName,
      storedName,
      mimeType: file.mimeType,
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

  if (!can(req.membership, "files.manage")) {
    throw new ApiError(403, "You do not have permission to merge files");
  }

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
  assertStorageConfigured();
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
  if (req.params.taskId && asset.taskId !== req.params.taskId) throw new ApiError(404, "Task attachment not found");
  if (asset.uploadedById !== req.userId && !can(req.membership, "files.manage")) {
    throw new ApiError(403, "You do not have permission to delete this file");
  }
  await assertAssetFolderAccess(req, asset);

  await deleteStoredVersions(workspaceId, asset.versions);
  await prisma.asset.delete({ where: { id: assetId } });

  emitToWorkspace(workspaceId, "asset:deleted", { id: assetId });
  res.json({ message: "Asset deleted" });
}

const moveSchema = z.object({ folderId: z.string().nullable() });

export async function moveAsset(req, res) {
  const { workspaceId, assetId } = req.params;
  const { folderId } = moveSchema.parse(req.body);

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { chatMessages: { select: { id: true }, take: 1 } },
  });
  if (!asset || asset.workspaceId !== workspaceId) throw new ApiError(404, "Asset not found");
  if (asset.uploadedById !== req.userId && !can(req.membership, "files.manage")) {
    throw new ApiError(403, "You do not have permission to move this file");
  }

  const folderById = asset.folderId || folderId ? await loadFolderAccessMap(workspaceId) : new Map();
  const sourceFolder = asset.folderId ? folderById.get(asset.folderId) : null;
  const sourceAncestry = sourceFolder ? resolveFolderAncestry(sourceFolder, folderById) : [];
  if (asset.folderId && (!sourceAncestry || !isFolderVisible(req.userId, req.membership, sourceFolder, folderById))) {
    throw new ApiError(403, "You don't have access to this file");
  }
  if (asset.chatMessages?.length || sourceAncestry.some((folder) => folder.chatConversationId)) {
    throw new ApiError(400, "Chat attachments cannot be moved from their managed folder");
  }
  if (!folderId && sourceAncestry.some((folder) => folder.visibility === "RESTRICTED")) {
    throw new ApiError(400, "Restricted files cannot be moved to the workspace root");
  }

  if (folderId) {
    const folder = folderById.get(folderId);
    if (!folder) throw new ApiError(404, "Folder not found");
    const destinationAncestry = resolveFolderAncestry(folder, folderById);
    if (!destinationAncestry) throw new ApiError(400, "Destination folder hierarchy is invalid");
    if (!isFolderVisible(req.userId, req.membership, folder, folderById)) {
      throw new ApiError(403, "You don't have access to this folder");
    }
    if (destinationAncestry.some((ancestor) => ancestor.chatConversationId)) {
      throw new ApiError(400, "Files cannot be moved into a managed chat folder");
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

import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { emitToWorkspace } from "../sockets/io.js";
import { isFolderVisible, canManageFolder } from "../services/folderAccess.js";

const folderInclude = {
  createdBy: { select: { id: true, name: true, avatarColor: true } },
  members: { include: { user: { select: { id: true, name: true, avatarColor: true } } } },
  _count: { select: { assets: true, children: true } },
};

function serializeFolder(folder) {
  return {
    id: folder.id,
    workspaceId: folder.workspaceId,
    name: folder.name,
    parentId: folder.parentId,
    visibility: folder.visibility,
    createdBy: folder.createdBy,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    members: folder.members.map((m) => m.user),
    assetCount: folder._count.assets,
    subfolderCount: folder._count.children,
  };
}

const folderSchema = z.object({
  name: z.string().min(1).max(120),
  parentId: z.string().nullable().optional(),
  visibility: z.enum(["WORKSPACE", "RESTRICTED"]).optional(),
  memberIds: z.array(z.string()).optional(),
});

// Returns every folder in the workspace the caller can see, flat (all
// levels) — small enough per workspace that the client filters by parentId
// locally instead of paginating per-navigation, same pattern used for assets.
export async function listFolders(req, res) {
  const { workspaceId } = req.params;
  const folders = await prisma.folder.findMany({
    where: { workspaceId },
    include: folderInclude,
    orderBy: { name: "asc" },
  });
  const visible = folders.filter((f) => isFolderVisible(req.userId, req.membership.role, f));
  res.json({ folders: visible.map(serializeFolder) });
}

export async function createFolder(req, res) {
  const { workspaceId } = req.params;
  const data = folderSchema.parse(req.body);

  if (data.parentId) {
    const parent = await prisma.folder.findUnique({ where: { id: data.parentId }, include: { members: true } });
    if (!parent || parent.workspaceId !== workspaceId) throw new ApiError(404, "Parent folder not found");
    if (!isFolderVisible(req.userId, req.membership.role, parent)) {
      throw new ApiError(403, "You don't have access to this folder");
    }
  }

  const visibility = data.visibility || "WORKSPACE";
  const folder = await prisma.folder.create({
    data: {
      workspaceId,
      name: data.name,
      parentId: data.parentId || null,
      visibility,
      createdById: req.userId,
      members:
        visibility === "RESTRICTED" && data.memberIds?.length
          ? { create: data.memberIds.map((userId) => ({ userId })) }
          : undefined,
    },
    include: folderInclude,
  });

  emitToWorkspace(workspaceId, "folder:created", serializeFolder(folder));
  res.status(201).json({ folder: serializeFolder(folder) });
}

export async function updateFolder(req, res) {
  const { workspaceId, folderId } = req.params;
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder || folder.workspaceId !== workspaceId) throw new ApiError(404, "Folder not found");
  if (!canManageFolder(req.userId, req.membership.role, folder)) {
    throw new ApiError(403, "You do not have permission to manage this folder");
  }

  const data = folderSchema.partial().parse(req.body);
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;

  if (data.parentId !== undefined && data.parentId !== folder.parentId) {
    if (data.parentId === folderId) throw new ApiError(400, "A folder cannot be its own parent");
    if (data.parentId) {
      const newParent = await prisma.folder.findUnique({ where: { id: data.parentId } });
      if (!newParent || newParent.workspaceId !== workspaceId) throw new ApiError(404, "Parent folder not found");
      let cursor = newParent;
      while (cursor) {
        if (cursor.id === folderId) throw new ApiError(400, "Cannot move a folder into its own subfolder");
        cursor = cursor.parentId ? await prisma.folder.findUnique({ where: { id: cursor.parentId } }) : null;
      }
    }
    updateData.parentId = data.parentId;
  }

  if (data.visibility !== undefined) updateData.visibility = data.visibility;

  await prisma.folder.update({ where: { id: folderId }, data: updateData });

  if (data.visibility !== undefined || data.memberIds !== undefined) {
    const nextVisibility = data.visibility !== undefined ? data.visibility : folder.visibility;
    await prisma.folderMember.deleteMany({ where: { folderId } });
    if (nextVisibility === "RESTRICTED" && data.memberIds?.length) {
      await prisma.folderMember.createMany({ data: data.memberIds.map((userId) => ({ folderId, userId })) });
    }
  }

  const updated = await prisma.folder.findUnique({ where: { id: folderId }, include: folderInclude });
  emitToWorkspace(workspaceId, "folder:updated", serializeFolder(updated));
  res.json({ folder: serializeFolder(updated) });
}

export async function deleteFolder(req, res) {
  const { workspaceId, folderId } = req.params;
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    include: { _count: { select: { assets: true, children: true } } },
  });
  if (!folder || folder.workspaceId !== workspaceId) throw new ApiError(404, "Folder not found");
  if (!canManageFolder(req.userId, req.membership.role, folder)) {
    throw new ApiError(403, "You do not have permission to manage this folder");
  }
  if (folder._count.assets > 0 || folder._count.children > 0) {
    throw new ApiError(400, "Folder is not empty");
  }

  await prisma.folder.delete({ where: { id: folderId } });
  emitToWorkspace(workspaceId, "folder:deleted", { id: folderId });
  res.json({ message: "Folder deleted" });
}

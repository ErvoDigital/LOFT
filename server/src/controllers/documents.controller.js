import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { emitToWorkspace } from "../sockets/io.js";
import { evictDocument } from "../sockets/documents.socket.js";
import { isDocumentVisible, canManageDocument } from "../services/documentAccess.js";

// content is deliberately never selected here — it's opaque Yjs binary that
// only ever travels over the document:join socket ack, never a REST body.
const documentSelect = {
  id: true,
  workspaceId: true,
  title: true,
  createdById: true,
  visibility: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, avatarColor: true } },
  assignees: { select: { userId: true, user: { select: { id: true, name: true, avatarColor: true } } } },
};

// select's assignees come back as raw DocumentAssignee rows (userId + a
// nested user) — isDocumentVisible needs the raw userId form, but the API
// response should just be a flat list of users, same reshaping
// folders.controller.js's serializeFolder does for folder.members.
function serializeDocument(document) {
  return { ...document, assignees: document.assignees.map((a) => a.user) };
}

// Returns every document in the workspace the caller can see — small enough
// per workspace that filtering happens app-side after the fetch, same
// list-then-filter pattern as folders.controller.js's listFolders.
export async function listWorkspaceDocuments(req, res) {
  const { workspaceId } = req.params;
  const documents = await prisma.document.findMany({
    where: { workspaceId },
    select: documentSelect,
    orderBy: { updatedAt: "desc" },
  });
  const visible = documents.filter((d) => isDocumentVisible(req.userId, req.membership.role, d));
  res.json({ documents: visible.map(serializeDocument) });
}

export async function getWorkspaceDocument(req, res) {
  const { workspaceId, documentId } = req.params;
  const document = await prisma.document.findUnique({ where: { id: documentId }, select: documentSelect });
  if (!document || document.workspaceId !== workspaceId) throw new ApiError(404, "Document not found");
  if (!isDocumentVisible(req.userId, req.membership.role, document)) {
    throw new ApiError(403, "You don't have access to this document");
  }
  res.json({ document: serializeDocument(document) });
}

const createSchema = z.object({ title: z.string().min(1).max(200).optional() });

export async function createWorkspaceDocument(req, res) {
  const { workspaceId } = req.params;
  const { title } = createSchema.parse(req.body || {});

  const document = await prisma.document.create({
    data: { workspaceId, title: title || undefined, createdById: req.userId },
    select: documentSelect,
  });

  const serialized = serializeDocument(document);
  emitToWorkspace(workspaceId, "document:created", serialized);
  res.status(201).json({ document: serialized });
}

const renameSchema = z.object({ title: z.string().min(1).max(200) });

export async function renameWorkspaceDocument(req, res) {
  const { workspaceId, documentId } = req.params;
  const { title } = renameSchema.parse(req.body);

  const existing = await prisma.document.findUnique({ where: { id: documentId }, include: { assignees: true } });
  if (!existing || existing.workspaceId !== workspaceId) throw new ApiError(404, "Document not found");
  if (!isDocumentVisible(req.userId, req.membership.role, existing)) {
    throw new ApiError(403, "You don't have access to this document");
  }

  const document = await prisma.document.update({ where: { id: documentId }, data: { title }, select: documentSelect });
  emitToWorkspace(workspaceId, "document:renamed", { id: document.id, title: document.title });
  res.json({ document: serializeDocument(document) });
}

const accessSchema = z.object({
  visibility: z.enum(["WORKSPACE", "ASSIGNED"]),
  assigneeIds: z.array(z.string()).optional(),
});

// Changing who a document is restricted to is creator-or-ADMIN only —
// stricter than rename, same shape as Folder's updateFolder requiring
// canManageFolder for visibility/memberIds changes, including the
// delete-then-recreate approach to the allow-list rather than diffing it.
export async function updateDocumentAccess(req, res) {
  const { workspaceId, documentId } = req.params;
  const existing = await prisma.document.findUnique({ where: { id: documentId } });
  if (!existing || existing.workspaceId !== workspaceId) throw new ApiError(404, "Document not found");
  if (!canManageDocument(req.userId, req.membership.role, existing)) {
    throw new ApiError(403, "You do not have permission to manage this document's access");
  }

  const data = accessSchema.parse(req.body);
  if (data.visibility === "ASSIGNED" && data.assigneeIds?.length) {
    const memberCount = await prisma.workspaceMember.count({
      where: { workspaceId, userId: { in: data.assigneeIds } },
    });
    if (memberCount !== data.assigneeIds.length) {
      throw new ApiError(400, "One or more assignees are not members of this workspace");
    }
  }

  await prisma.document.update({ where: { id: documentId }, data: { visibility: data.visibility } });
  await prisma.documentAssignee.deleteMany({ where: { documentId } });
  if (data.visibility === "ASSIGNED" && data.assigneeIds?.length) {
    await prisma.documentAssignee.createMany({ data: data.assigneeIds.map((userId) => ({ documentId, userId })) });
  }

  const document = await prisma.document.findUnique({ where: { id: documentId }, select: documentSelect });
  emitToWorkspace(workspaceId, "document:updated", { id: document.id, updatedAt: document.updatedAt });
  res.json({ document: serializeDocument(document) });
}

export async function deleteWorkspaceDocument(req, res) {
  const { workspaceId, documentId } = req.params;
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document || document.workspaceId !== workspaceId) throw new ApiError(404, "Document not found");
  if (document.createdById !== req.userId && req.membership.role !== "ADMIN") {
    throw new ApiError(403, "You do not have permission to delete this document");
  }

  await prisma.document.delete({ where: { id: documentId } });
  evictDocument(documentId);
  emitToWorkspace(workspaceId, "document:deleted", { id: documentId });
  res.json({ message: "Document deleted" });
}

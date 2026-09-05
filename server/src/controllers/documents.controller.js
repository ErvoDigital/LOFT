import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { emitToWorkspace } from "../sockets/io.js";
import { evictDocument } from "../sockets/documents.socket.js";

// content is deliberately never selected here — it's opaque Yjs binary that
// only ever travels over the document:join socket ack, never a REST body.
const documentSelect = {
  id: true,
  workspaceId: true,
  title: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, avatarColor: true } },
};

export async function listWorkspaceDocuments(req, res) {
  const { workspaceId } = req.params;
  const documents = await prisma.document.findMany({
    where: { workspaceId },
    select: documentSelect,
    orderBy: { updatedAt: "desc" },
  });
  res.json({ documents });
}

export async function getWorkspaceDocument(req, res) {
  const { workspaceId, documentId } = req.params;
  const document = await prisma.document.findUnique({ where: { id: documentId }, select: documentSelect });
  if (!document || document.workspaceId !== workspaceId) throw new ApiError(404, "Document not found");
  res.json({ document });
}

const createSchema = z.object({ title: z.string().min(1).max(200).optional() });

export async function createWorkspaceDocument(req, res) {
  const { workspaceId } = req.params;
  const { title } = createSchema.parse(req.body || {});

  const document = await prisma.document.create({
    data: { workspaceId, title: title || undefined, createdById: req.userId },
    select: documentSelect,
  });

  emitToWorkspace(workspaceId, "document:created", document);
  res.status(201).json({ document });
}

const renameSchema = z.object({ title: z.string().min(1).max(200) });

export async function renameWorkspaceDocument(req, res) {
  const { workspaceId, documentId } = req.params;
  const { title } = renameSchema.parse(req.body);

  const existing = await prisma.document.findUnique({ where: { id: documentId } });
  if (!existing || existing.workspaceId !== workspaceId) throw new ApiError(404, "Document not found");

  const document = await prisma.document.update({ where: { id: documentId }, data: { title }, select: documentSelect });
  emitToWorkspace(workspaceId, "document:renamed", { id: document.id, title: document.title });
  res.json({ document });
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

import { z } from "zod";
import * as Y from "yjs";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { isDocumentVisible } from "../services/documentAccess.js";

async function authorizedDocument(req) {
  const document = await prisma.document.findUnique({ where: { id: req.params.documentId }, include: { assignees: true } });
  if (!document || document.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Document not found");
  if (!isDocumentVisible(req.userId, req.membership, document)) throw new ApiError(403, "Document is not accessible");
  return document;
}
export async function listRevisions(req, res) {
  await authorizedDocument(req);
  const revisions = await prisma.documentRevision.findMany({ where: { documentId: req.params.documentId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, title: true, createdAt: true, createdById: true } });
  res.json({ revisions });
}
export async function getRevision(req, res) {
  await authorizedDocument(req);
  const revision = await prisma.documentRevision.findUnique({ where: { id: req.params.revisionId } });
  if (!revision || revision.documentId !== req.params.documentId) throw new ApiError(404, "Version not found");
  res.json({ revision: { ...revision, content: Buffer.from(revision.content).toString("base64") } });
}
export async function createRevision(req, res) {
  const document = await authorizedDocument(req);
  const { content } = z.object({ content: z.string().min(1).max(1800000) }).strict().parse(req.body);
  const bytes = Buffer.from(content, "base64"), ydoc = new Y.Doc();
  try { Y.applyUpdate(ydoc, bytes); } catch { throw new ApiError(400, "Invalid document snapshot"); } finally { ydoc.destroy(); }
  const revision = await prisma.documentRevision.create({ data: { documentId: document.id, title: document.title, content: bytes, createdById: req.userId }, select: { id: true, title: true, createdAt: true } });
  const old = await prisma.documentRevision.findMany({ where: { documentId: document.id }, orderBy: { createdAt: "desc" }, skip: 50, select: { id: true } });
  if (old.length) await prisma.documentRevision.deleteMany({ where: { id: { in: old.map((item) => item.id) } } });
  res.status(201).json({ revision });
}

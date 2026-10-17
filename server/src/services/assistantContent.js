import { z } from "zod";
import * as Y from "yjs";
import { ApiError } from "../utils/ApiError.js";
import { isDocumentVisible } from "./documentAccess.js";

export async function readAssistantContent(name, args, { userId, workspaceId, db }) {
  const { recordId } = z.object({ recordId: z.string().uuid() }).strict().parse(args);
  if (name === "read_document") {
    const document = await db.document.findUnique({ where: { id: recordId }, include: { assignees: true } });
    if (!document || (workspaceId && document.workspaceId !== workspaceId)) throw new ApiError(404, "Document not found in this context");
    const member = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: document.workspaceId, userId } } });
    if (!member || !isDocumentVisible(userId, member, document)) throw new ApiError(403, "Document is not accessible");
    const doc = new Y.Doc(); let text = "";
    try { if (document.content) Y.applyUpdate(doc, document.content); text = doc.getXmlFragment("default").toString().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); } finally { doc.destroy(); }
    return { title: document.title, text: text.slice(0, 12000), truncated: text.length > 12000, sources: [{ title: document.title, url: `/workspaces/${document.workspaceId}/docs/${document.id}` }] };
  }
  const conversation = await db.conversation.findUnique({ where: { id: recordId }, include: { participants: true } });
  if (!conversation || conversation.isMeetingChat || !conversation.participants.some((person) => person.userId === userId) || (workspaceId && conversation.workspaceId !== workspaceId)) throw new ApiError(403, "Conversation is not accessible in this context");
  if (conversation.workspaceId && !await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: conversation.workspaceId, userId } } })) throw new ApiError(403, "Workspace access was removed");
  const rows = await db.message.findMany({ where: { conversationId: recordId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, content: true, createdAt: true, sender: { select: { name: true } } } });
  return { title: conversation.title || "Conversation", limit: 50, messages: rows.reverse().map((row) => ({ id: row.id, author: row.sender.name, content: row.content.slice(0, 1000), createdAt: row.createdAt })), sources: [{ title: conversation.title || "Conversation", url: `${conversation.workspaceId ? `/workspaces/${conversation.workspaceId}/chat` : "/chat"}?conversation=${recordId}` }] };
}

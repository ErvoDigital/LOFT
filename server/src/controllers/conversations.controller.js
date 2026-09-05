import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { notify } from "../services/notification.service.js";
import { emitToWorkspace } from "../sockets/io.js";

const participantSelect = { select: { id: true, name: true, avatarColor: true, avatarUrl: true } };

function serialize(conversation, lastMessage) {
  return {
    id: conversation.id,
    workspaceId: conversation.workspaceId,
    isGroup: conversation.isGroup,
    isDefault: conversation.isDefault,
    title: conversation.title,
    createdById: conversation.createdById,
    participants: conversation.participants?.map((p) => p.user),
    lastMessage: lastMessage
      ? { id: lastMessage.id, content: lastMessage.content, createdAt: lastMessage.createdAt, sender: lastMessage.sender }
      : null,
  };
}

// Only this workspace's own channels — never mixed with any other
// workspace's chats, and only channels the caller actually belongs to.
export async function listWorkspaceConversations(req, res) {
  const conversations = await prisma.conversation.findMany({
    where: { workspaceId: req.params.workspaceId, participants: { some: { userId: req.userId } } },
    include: { participants: { include: { user: participantSelect } } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  const lastMessages = await prisma.message.findMany({
    where: { conversationId: { in: conversations.map((c) => c.id) } },
    orderBy: { createdAt: "desc" },
    include: { sender: { select: { id: true, name: true } } },
  });
  const lastByConv = new Map();
  for (const m of lastMessages) {
    if (!lastByConv.has(m.conversationId)) lastByConv.set(m.conversationId, m);
  }

  res.json({ conversations: conversations.map((c) => serialize(c, lastByConv.get(c.id))) });
}

const createSchema = z.object({
  title: z.string().min(1).max(80),
  memberIds: z.array(z.string()).default([]),
});

// Admin-only: create an additional named channel within the workspace with
// a hand-picked member list (the default "General" channel already covers
// everyone — this is for smaller groups within it).
export async function createWorkspaceConversation(req, res) {
  if (req.membership.role !== "ADMIN") throw new ApiError(403, "Only workspace admins can create group chats");

  const { title, memberIds } = createSchema.parse(req.body);
  const workspaceId = req.params.workspaceId;

  const validMembers = await prisma.workspaceMember.findMany({
    where: { workspaceId, userId: { in: memberIds } },
    select: { userId: true },
  });
  const participantIds = Array.from(new Set([req.userId, ...validMembers.map((m) => m.userId)]));

  const conversation = await prisma.conversation.create({
    data: {
      workspaceId,
      isGroup: true,
      isDefault: false,
      title,
      createdById: req.userId,
      participants: { create: participantIds.map((userId) => ({ userId })) },
    },
    include: { participants: { include: { user: participantSelect } } },
  });

  emitToWorkspace(workspaceId, "conversation:created", serialize(conversation));
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  await Promise.all(
    participantIds
      .filter((id) => id !== req.userId)
      .map((userId) =>
        notify(userId, {
          type: "WORKSPACE_INVITE",
          title: `Added to "${title}"`,
          body: workspace.name,
          link: `/workspaces/${workspaceId}/chat`,
        })
      )
  );

  res.status(201).json({ conversation: serialize(conversation) });
}

export async function deleteWorkspaceConversation(req, res) {
  if (req.membership.role !== "ADMIN") throw new ApiError(403, "Only workspace admins can delete group chats");

  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.conversationId } });
  if (!conversation || conversation.workspaceId !== req.params.workspaceId) {
    throw new ApiError(404, "Channel not found");
  }
  if (conversation.isDefault) throw new ApiError(400, "The General channel can't be deleted");

  await prisma.conversation.delete({ where: { id: conversation.id } });
  emitToWorkspace(req.params.workspaceId, "conversation:deleted", { id: conversation.id });
  res.json({ message: "Channel deleted" });
}

import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { notify } from "../services/notification.service.js";

const sendSchema = z.object({
  content: z.string().max(4000).default(""),
  attachmentAssetId: z.string().optional(),
});

// See the matching helper in sockets/chat.socket.js — kept in sync there and
// in realtime/src/index.js (the raw-WebSocket service that actually handles
// message:send in production; this REST path exists alongside it, not
// instead of it).
const MENTION_RE = /@\[([^\]]{1,80})\]\(([^)]{1,64})\)/g;

function extractMentionedUserIds(content, participantIds, excludeUserId) {
  const ids = new Set();
  let match;
  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(content))) {
    if (match[2] !== excludeUserId && participantIds.includes(match[2])) ids.add(match[2]);
  }
  return [...ids];
}

function plainTextPreview(content) {
  return content.replace(MENTION_RE, "@$1").trim();
}

function serializeAttachment(asset) {
  if (!asset) return null;
  const latest = asset.versions[0];
  if (!latest) return null;
  return {
    assetId: asset.id,
    versionId: latest.id,
    name: asset.name,
    originalName: latest.originalName,
    mimeType: latest.mimeType,
    size: latest.size,
  };
}

const messageInclude = {
  sender: { select: { id: true, name: true, avatarColor: true, avatarUrl: true } },
  attachment: { include: { versions: { orderBy: { version: "desc" }, take: 1 } } },
};

function serializeMessage(message) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    content: message.content,
    createdAt: message.createdAt,
    sender: message.sender,
    attachment: serializeAttachment(message.attachment),
  };
}

// Every conversation the user is an explicit participant of — workspace
// channels and direct messages alike. Membership in a workspace no longer
// implies access to its channels; you have to actually be added.
export async function listConversations(req, res) {
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: req.userId } } },
    include: {
      workspace: { select: { id: true, name: true, color: true } },
      participants: { include: { user: { select: { id: true, name: true, avatarColor: true, avatarUrl: true } } } },
    },
  });

  const lastMessages = await prisma.message.findMany({
    where: { conversationId: { in: conversations.map((c) => c.id) } },
    orderBy: { createdAt: "desc" },
    include: { sender: { select: { id: true, name: true } }, attachment: { include: { versions: { orderBy: { version: "desc" }, take: 1 } } } },
  });
  const lastByConv = new Map();
  for (const m of lastMessages) {
    if (!lastByConv.has(m.conversationId)) lastByConv.set(m.conversationId, m);
  }

  const all = conversations.map((c) => {
    const base = {
      id: c.id,
      isGroup: c.isGroup,
      participants: c.participants.map((p) => p.user),
      lastMessage: lastByConv.get(c.id) ? serializeMessage(lastByConv.get(c.id)) : null,
    };
    if (c.isGroup) {
      return {
        ...base,
        workspaceId: c.workspaceId,
        title: c.isDefault ? c.workspace.name : c.title,
        color: c.workspace?.color,
        isDefault: c.isDefault,
      };
    }
    const other = c.participants.find((p) => p.userId !== req.userId)?.user;
    return { ...base, title: other?.name || "Direct message", otherUser: other };
  });

  all.sort((a, b) => {
    const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return bt - at;
  });

  res.json({ conversations: all });
}

async function assertParticipant(conversationId, userId) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) throw new ApiError(403, "You are not part of this conversation");

  return conversation;
}

export async function getMessages(req, res) {
  await assertParticipant(req.params.conversationId, req.userId);

  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.conversationId },
    include: messageInclude,
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  res.json({ messages: messages.map(serializeMessage) });
}

export async function sendMessageRest(req, res) {
  const { content, attachmentAssetId } = sendSchema.parse(req.body);
  const trimmed = content.trim();
  if (!trimmed && !attachmentAssetId) throw new ApiError(400, "Message must have content or an attachment");

  const conversation = await assertParticipant(req.params.conversationId, req.userId);
  const conversationId = req.params.conversationId;

  if (attachmentAssetId) {
    const asset = await prisma.asset.findUnique({ where: { id: attachmentAssetId }, include: { folder: true } });
    if (!asset || asset.workspaceId !== conversation.workspaceId || asset.folder?.chatConversationId !== conversationId) {
      throw new ApiError(400, "Invalid attachment");
    }
  }

  const message = await prisma.message.create({
    data: { conversationId, senderId: req.userId, content: trimmed, attachmentAssetId: attachmentAssetId || null },
    include: messageInclude,
  });

  const participants = await prisma.conversationParticipant.findMany({ where: { conversationId } });
  const mentionedIds = extractMentionedUserIds(trimmed, participants.map((p) => p.userId), req.userId);
  const link = conversation.workspaceId ? `/workspaces/${conversation.workspaceId}/chat` : "/chat";
  await Promise.all(
    mentionedIds.map((userId) =>
      notify(userId, {
        type: "MENTION",
        title: `${message.sender.name} mentioned you`,
        body: plainTextPreview(trimmed).slice(0, 140) || "Sent an attachment",
        link,
      })
    )
  );

  res.status(201).json({ message: serializeMessage(message) });
}

export async function startDirectMessage(req, res) {
  const otherUserId = req.params.userId;
  if (otherUserId === req.userId) throw new ApiError(400, "Cannot message yourself");

  const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!otherUser) throw new ApiError(404, "User not found");

  const existing = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      AND: [
        { participants: { some: { userId: req.userId } } },
        { participants: { some: { userId: otherUserId } } },
      ],
    },
  });
  if (existing) return res.json({ conversationId: existing.id });

  const conversation = await prisma.conversation.create({
    data: {
      isGroup: false,
      participants: { create: [{ userId: req.userId }, { userId: otherUserId }] },
    },
  });

  res.status(201).json({ conversationId: conversation.id });
}

import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { notify } from "../services/notification.service.js";
import { emitToUser } from "../sockets/io.js";

const sendSchema = z.object({
  content: z.string().max(4000).default(""),
  attachmentAssetId: z.string().optional(),
});

// A single pictograph, optionally followed by a variation selector, skin-tone
// modifier, or ZWJ-joined pictographs (covers "👍🏽", "❤️", "👨‍👩‍👧‍👦", and
// everything in EmojiPicker's own list). Re-validated here rather than
// trusted as-is since this is an API endpoint, not just a UI constraint.
const EMOJI_RE = /^\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|️|‍\p{Extended_Pictographic})*$/u;
const reactSchema = z.object({ emoji: z.string().max(32).regex(EMOJI_RE, "Invalid emoji") });

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
  reactions: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
};

// Groups flat reaction rows into one entry per emoji, in the order each
// emoji was first used on this message. The client derives count/"mine"
// from `users` itself rather than trusting a precomputed viewer-specific
// flag, since this same shape is broadcast unchanged to every participant.
function serializeReactions(reactions) {
  const order = [];
  const byEmoji = new Map();
  for (const r of reactions) {
    if (!byEmoji.has(r.emoji)) {
      byEmoji.set(r.emoji, []);
      order.push(r.emoji);
    }
    byEmoji.get(r.emoji).push({ id: r.user.id, name: r.user.name });
  }
  return order.map((emoji) => ({ emoji, users: byEmoji.get(emoji) }));
}

function serializeMessage(message) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    content: message.content,
    createdAt: message.createdAt,
    sender: message.sender,
    attachment: serializeAttachment(message.attachment),
    reactions: message.reactions ? serializeReactions(message.reactions) : [],
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

// Toggles the caller's own reaction: adding it if they haven't reacted with
// this emoji yet, removing it if they have. Mirrored in chat.socket.js and
// realtime/src/index.js, which is what the web client actually calls.
export async function toggleReaction(req, res) {
  const { emoji } = reactSchema.parse(req.body);
  const { conversationId, messageId } = req.params;
  await assertParticipant(conversationId, req.userId);

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.conversationId !== conversationId) throw new ApiError(404, "Message not found");

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId: req.userId, emoji } },
  });
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({ data: { messageId, userId: req.userId, emoji } });
  }

  const reactions = await prisma.messageReaction.findMany({
    where: { messageId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.json({ messageId, reactions: serializeReactions(reactions) });
}

// Removes a message for everyone in the conversation. The sender can always
// delete their own; in a workspace channel, that workspace's admins can also
// delete anyone's, so a channel can be moderated. An attached file stays in
// the workspace's Storage — only the message pointing at it goes.
//
// Broadcast to each participant's user room rather than the conversation
// room, so every client hears it exactly once whether or not the thread is
// open, and conversation lists can refresh a preview that just disappeared.
export async function deleteMessage(req, res) {
  const { conversationId, messageId } = req.params;
  const conversation = await assertParticipant(conversationId, req.userId);

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.conversationId !== conversationId) throw new ApiError(404, "Message not found");

  if (message.senderId !== req.userId) {
    const membership = conversation.workspaceId
      ? await prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: conversation.workspaceId, userId: req.userId } },
        })
      : null;
    if (membership?.role !== "ADMIN") throw new ApiError(403, "You can only delete your own messages");
  }

  await prisma.message.delete({ where: { id: messageId } });

  const participants = await prisma.conversationParticipant.findMany({ where: { conversationId } });
  for (const p of participants) {
    emitToUser(p.userId, "message:deleted", { conversationId, messageId, workspaceId: conversation.workspaceId });
  }

  res.json({ conversationId, messageId });
}

// Deletes a direct message thread, with its whole history, for both people
// in it — either one can do it. Workspace channels go through
// conversations.controller.js's admin-only delete instead.
export async function deleteDirectConversation(req, res) {
  const conversation = await assertParticipant(req.params.conversationId, req.userId);
  if (conversation.isGroup) throw new ApiError(400, "Only direct messages can be deleted here");

  const participants = await prisma.conversationParticipant.findMany({ where: { conversationId: conversation.id } });
  await prisma.conversation.delete({ where: { id: conversation.id } });
  for (const p of participants) {
    emitToUser(p.userId, "conversation:deleted", { id: conversation.id });
  }

  res.json({ message: "Conversation deleted" });
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

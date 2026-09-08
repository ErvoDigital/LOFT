import { Server } from "socket.io";
import { verifyToken } from "../utils/jwt.js";
import { prisma } from "../db/prisma.js";
import { setIo } from "./io.js";
import { registerMeetingHandlers } from "./meeting.socket.js";
import { registerDocumentHandlers } from "./documents.socket.js";
import { notify } from "../services/notification.service.js";

// Matches the `@[Name](userId)` tokens the client writes into message
// content when it recognizes a typed name against the conversation's
// participant list. Re-extracted here rather than trusted as-is, since
// content otherwise arrives as untrusted client input — only ids that are
// actually participants of this conversation get notified.
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

export function initSockets(httpServer, corsOrigin) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
  });
  setIo(io);

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Missing token"));
      const payload = verifyToken(token);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`);

    // Listener registration is synchronous and must happen before any
    // `await` in this handler — a client that emits a room-specific event
    // (document:join, conversation:join, etc.) right after "connect" fires
    // races an async setup step here: if the event arrives before its
    // listener exists, Socket.io drops it silently (no queueing, no error).
    // This isn't hypothetical — a reconnect-triggered resync does exactly
    // this. So every socket.on(...) below must be registered up front, with
    // the workspace-room joins (needed only for emitToWorkspace broadcasts,
    // not for any of these listeners) as a non-blocking side effect after.
    registerMeetingHandlers(io, socket);
    registerDocumentHandlers(io, socket);

    socket.on("conversation:join", (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("conversation:leave", (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on("message:send", async ({ conversationId, content, attachmentAssetId }, ack) => {
      try {
        const trimmed = String(content || "").trim();
        if ((!trimmed && !attachmentAssetId) || !conversationId) return ack?.({ error: "Invalid message" });

        const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conversation) return ack?.({ error: "Conversation not found" });

        const participants = await prisma.conversationParticipant.findMany({ where: { conversationId } });
        if (!participants.some((p) => p.userId === socket.userId)) {
          return ack?.({ error: "Not part of this conversation" });
        }

        // An attachment must live in this conversation's own chat folder —
        // that folder is only ever populated via uploadChatAttachment, which
        // already checked the uploader was a participant here, so this is
        // both a sanity check and the full access-control story: no separate
        // folder-visibility check is needed on top of it.
        if (attachmentAssetId) {
          const asset = await prisma.asset.findUnique({
            where: { id: attachmentAssetId },
            include: { folder: true },
          });
          if (!asset || asset.workspaceId !== conversation.workspaceId || asset.folder?.chatConversationId !== conversationId) {
            return ack?.({ error: "Invalid attachment" });
          }
        }

        const message = await prisma.message.create({
          data: { conversationId, senderId: socket.userId, content: trimmed, attachmentAssetId: attachmentAssetId || null },
          include: {
            sender: { select: { id: true, name: true, avatarColor: true, avatarUrl: true } },
            attachment: { include: { versions: { orderBy: { version: "desc" }, take: 1 } } },
          },
        });

        const payload = {
          id: message.id,
          conversationId,
          content: message.content,
          createdAt: message.createdAt,
          sender: message.sender,
          attachment: serializeAttachment(message.attachment),
        };

        io.to(`conversation:${conversationId}`).emit("message:new", payload);
        for (const p of participants) {
          io.to(`user:${p.userId}`).emit("message:preview", {
            conversationId,
            workspaceId: conversation.workspaceId,
            ...payload,
          });
        }

        const mentionedIds = extractMentionedUserIds(trimmed, participants.map((p) => p.userId), socket.userId);
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

        ack?.({ message: payload });
      } catch (err) {
        console.error("message:send failed", err);
        ack?.({ error: "Failed to send message" });
      }
    });

    socket.on("typing", ({ conversationId, isTyping }) => {
      socket.to(`conversation:${conversationId}`).emit("typing", {
        conversationId,
        userId: socket.userId,
        isTyping: !!isTyping,
      });
    });

    prisma.workspaceMember
      .findMany({ where: { userId: socket.userId } })
      .then((memberships) => {
        for (const m of memberships) {
          socket.join(`workspace:${m.workspaceId}`);
        }
      })
      .catch((err) => console.error("Failed to join workspace rooms", err));
  });

  return io;
}

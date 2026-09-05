import { Server } from "socket.io";
import { verifyToken } from "../utils/jwt.js";
import { prisma } from "../db/prisma.js";
import { setIo } from "./io.js";
import { registerMeetingHandlers } from "./meeting.socket.js";
import { registerDocumentHandlers } from "./documents.socket.js";

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

    socket.on("message:send", async ({ conversationId, content }, ack) => {
      try {
        const trimmed = String(content || "").trim();
        if (!trimmed || !conversationId) return ack?.({ error: "Invalid message" });

        const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conversation) return ack?.({ error: "Conversation not found" });

        const participants = await prisma.conversationParticipant.findMany({ where: { conversationId } });
        if (!participants.some((p) => p.userId === socket.userId)) {
          return ack?.({ error: "Not part of this conversation" });
        }

        const message = await prisma.message.create({
          data: { conversationId, senderId: socket.userId, content: trimmed },
          include: { sender: { select: { id: true, name: true, avatarColor: true, avatarUrl: true } } },
        });

        const payload = {
          id: message.id,
          conversationId,
          content: message.content,
          createdAt: message.createdAt,
          sender: message.sender,
        };

        io.to(`conversation:${conversationId}`).emit("message:new", payload);
        for (const p of participants) {
          io.to(`user:${p.userId}`).emit("message:preview", {
            conversationId,
            workspaceId: conversation.workspaceId,
            ...payload,
          });
        }

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

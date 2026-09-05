import * as Y from "yjs";
import { prisma } from "../db/prisma.js";
import { emitToWorkspace } from "./io.js";

// In-memory authoritative merge point per open document — lets a late joiner
// sync via one full-state message instead of replayed history, and decouples
// persistence from any single client's connection lifecycle. Lost on server
// restart, same pre-existing limitation as meeting.socket.js's room Map.
// documentId -> { ydoc, workspaceId, sockets: Map<socketId, {userId,name,avatarColor}>, saveTimer, maxWaitTimer, dirty }
const docs = new Map();

const SAVE_DEBOUNCE_MS = 10_000;
const SAVE_MAX_WAIT_MS = 30_000;

function scheduleSave(documentId) {
  const entry = docs.get(documentId);
  if (!entry) return;
  entry.dirty = true;
  clearTimeout(entry.saveTimer);
  entry.saveTimer = setTimeout(() => flushSave(documentId), SAVE_DEBOUNCE_MS);
  if (!entry.maxWaitTimer) {
    entry.maxWaitTimer = setTimeout(() => flushSave(documentId), SAVE_MAX_WAIT_MS);
  }
}

async function flushSave(documentId) {
  const entry = docs.get(documentId);
  if (!entry) return;
  clearTimeout(entry.saveTimer);
  entry.saveTimer = null;
  clearTimeout(entry.maxWaitTimer);
  entry.maxWaitTimer = null;
  if (!entry.dirty) return;
  entry.dirty = false;

  const content = Buffer.from(Y.encodeStateAsUpdate(entry.ydoc));
  try {
    const updated = await prisma.document.update({ where: { id: documentId }, data: { content } });
    emitToWorkspace(entry.workspaceId, "document:updated", { id: documentId, updatedAt: updated.updatedAt });
  } catch (err) {
    console.error("document autosave failed", err);
  }
}

// Purges any live in-memory doc/timers without attempting a final save — used
// when the row itself has just been deleted, so there's nothing left to save
// into (a save attempt there would just throw a Prisma not-found error).
export function evictDocument(documentId) {
  const entry = docs.get(documentId);
  if (!entry) return;
  clearTimeout(entry.saveTimer);
  clearTimeout(entry.maxWaitTimer);
  docs.delete(documentId);
}

export function registerDocumentHandlers(io, socket) {
  socket.on("document:join", async (documentId, ack) => {
    try {
      const doc = await prisma.document.findUnique({ where: { id: documentId } });
      if (!doc) return ack?.({ error: "Document not found" });

      const [member, user] = await Promise.all([
        prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: doc.workspaceId, userId: socket.userId } },
        }),
        prisma.user.findUnique({ where: { id: socket.userId }, select: { id: true, name: true, avatarColor: true } }),
      ]);
      if (!member) return ack?.({ error: "Not a member of this workspace" });

      let entry = docs.get(documentId);
      if (!entry) {
        const ydoc = new Y.Doc();
        if (doc.content) Y.applyUpdate(ydoc, doc.content);
        entry = { ydoc, workspaceId: doc.workspaceId, sockets: new Map(), saveTimer: null, maxWaitTimer: null, dirty: false };
        docs.set(documentId, entry);
      }

      // Keyed by `userId` (not `id`) everywhere presence is sent, matching
      // document:presence-leave's shape, so the client can dedup/filter with
      // one consistent field instead of two different id keys.
      const presence = { userId: user.id, name: user.name, avatarColor: user.avatarColor };
      const existingPeers = Array.from(entry.sockets.values());
      entry.sockets.set(socket.id, presence);
      socket.join(`document:${documentId}`);
      socket.data.openDocumentId = documentId;

      ack?.({ update: Y.encodeStateAsUpdate(entry.ydoc), title: doc.title, updatedAt: doc.updatedAt, peers: existingPeers });

      const room = `document:${documentId}`;
      socket.to(room).emit("document:presence-join", presence);
      socket.to(room).emit("document:awareness-request");
    } catch (err) {
      console.error("document:join failed", err);
      ack?.({ error: "Failed to open document" });
    }
  });

  socket.on("document:update", ({ documentId, update }) => {
    const entry = docs.get(documentId);
    if (!entry || !entry.sockets.has(socket.id)) return;
    Y.applyUpdate(entry.ydoc, new Uint8Array(update));
    socket.to(`document:${documentId}`).emit("document:update", { update });
    scheduleSave(documentId);
  });

  socket.on("document:awareness", ({ documentId, update }) => {
    const entry = docs.get(documentId);
    if (!entry || !entry.sockets.has(socket.id)) return;
    socket.to(`document:${documentId}`).emit("document:awareness", { update });
  });

  function leaveDocument() {
    const documentId = socket.data.openDocumentId;
    if (!documentId) return;
    const entry = docs.get(documentId);
    if (entry) {
      entry.sockets.delete(socket.id);
      // Only announce a departure if this user has no *other* socket still in
      // the room (e.g. a second tab) — otherwise a single-tab refresh or a
      // second window closing would incorrectly drop them from every other
      // viewer's presence bar.
      const stillPresent = Array.from(entry.sockets.values()).some((p) => p.userId === socket.userId);
      if (!stillPresent) {
        socket.to(`document:${documentId}`).emit("document:presence-leave", { userId: socket.userId });
      }
      if (entry.sockets.size === 0) {
        flushSave(documentId).finally(() => {
          // Only evict if nobody rejoined while the save was in flight.
          if (docs.get(documentId)?.sockets.size === 0) docs.delete(documentId);
        });
      }
    }
    socket.leave(`document:${documentId}`);
    socket.data.openDocumentId = null;
  }

  socket.on("document:leave", leaveDocument);
  socket.on("disconnecting", leaveDocument);
}

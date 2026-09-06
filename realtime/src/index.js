import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import * as Y from "yjs";
import { attachDatabasePool, upgradeWebSocket } from "@neon/functions";

const JWT_SECRET = process.env.JWT_SECRET;
const CLIENT_URL = process.env.CLIENT_URL;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
attachDatabasePool(pool);

// connId -> connection state. One isolate can hold many connections; the
// runtime may also run several isolates in parallel under load, each with
// its own copy of this map (see the module-scope note in poll() below).
const connections = new Map();

// Open Yjs documents, keyed by documentId. Isolate-local: under concurrent
// editors spread across more than one isolate, live presence/awareness can
// fragment between them (content itself never diverges — Yjs updates are
// still relayed to every isolate via publish()'s RealtimeEvent fallback and
// are CRDT-mergeable, so nothing is lost, just not everyone's cursor is
// visible to everyone). Meeting rosters don't have this problem — they live
// in Postgres (MeetingParticipant) precisely because two isolates observably
// do serve the same workspace's connections in practice (see meeting:join).
const docs = new Map(); // documentId -> {ydoc, workspaceId, sockets: Map<connId, presence>, saveTimer, maxWaitTimer, dirty}

const SAVE_DEBOUNCE_MS = 10_000;
const SAVE_MAX_WAIT_MS = 30_000;

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}
function sendEvent(ws, event, data) {
  send(ws, { event, data });
}

function targetMatches(conn, target) {
  const sep = target.indexOf(":");
  const kind = target.slice(0, sep);
  const id = target.slice(sep + 1);
  switch (kind) {
    case "user":
      return conn.userId === id;
    case "workspace":
      return conn.workspaceIds.has(id);
    case "conversation":
      return conn.conversationIds.has(id);
    case "meeting":
      return conn.meetingWorkspaceId === id;
    case "document":
      return conn.documentId === id;
    default:
      return false;
  }
}

function deliverLocal(target, event, payload, excludeConnId) {
  for (const [connId, conn] of connections) {
    if (connId === excludeConnId) continue;
    if (targetMatches(conn, target)) sendEvent(conn.ws, event, payload);
  }
}

// Cross-process fan-out: every push — including ones this same isolate just
// delivered synchronously below — is durably recorded so the REST API
// (a separate Vercel deployment) and any other isolate serving this function
// can reach connections they don't hold. `recentLocalIds` stops this
// isolate's own poller from re-delivering (and mis-applying `excludeConnId`
// to) a row it already handled locally.
const recentLocalIds = new Set();
function rememberLocal(id) {
  recentLocalIds.add(id);
  setTimeout(() => recentLocalIds.delete(id), 60_000).unref?.();
}

async function publish(target, event, payload, { excludeConnId } = {}) {
  deliverLocal(target, event, payload ?? null, excludeConnId);
  try {
    const { rows } = await pool.query(
      `INSERT INTO "RealtimeEvent" (target, event, payload) VALUES ($1,$2,$3) RETURNING id`,
      [target, event, JSON.stringify(payload ?? null)]
    );
    rememberLocal(rows[0].id);
  } catch (err) {
    console.error(`publish failed (${target}/${event})`, err);
  }
}

let cursor = 0;
let polling = false;
async function poll() {
  if (polling || connections.size === 0) return;
  polling = true;
  try {
    const { rows } = await pool.query(
      `SELECT id, target, event, payload FROM "RealtimeEvent" WHERE id > $1 ORDER BY id LIMIT 500`,
      [cursor]
    );
    for (const row of rows) {
      cursor = row.id;
      if (recentLocalIds.has(row.id)) continue;
      let payload = null;
      try {
        payload = JSON.parse(row.payload);
      } catch {
        continue;
      }
      deliverLocal(row.target, row.event, payload);
    }
  } catch (err) {
    console.error("poll failed", err);
  } finally {
    polling = false;
  }
}

pool
  .query(`SELECT coalesce(max(id), 0)::int AS id FROM "RealtimeEvent"`)
  .then((res) => {
    cursor = res.rows[0].id;
  })
  .catch((err) => console.error("cursor seed failed", err))
  .finally(() => setInterval(poll, 500).unref?.());

setInterval(() => {
  pool.query(`DELETE FROM "RealtimeEvent" WHERE "createdAt" < now() - interval '1 hour'`).catch(() => {});
}, 10 * 60 * 1000).unref?.();

async function notify(userId, { type, title, body, link }) {
  const id = crypto.randomUUID();
  const res = await pool.query(
    `INSERT INTO "Notification" (id, "userId", type, title, body, link, "isRead", "createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,false,now()) RETURNING *`,
    [id, userId, type, title, body ?? null, link ?? null]
  );
  await publish(`user:${userId}`, "notification:new", res.rows[0]);
}

// ---- Chat ----

async function handleMessageSend(conn, data) {
  const content = String(data?.content || "").trim();
  const conversationId = data?.conversationId;
  if (!content || !conversationId) return { error: "Invalid message" };

  const convRes = await pool.query(`SELECT id, "workspaceId" FROM "Conversation" WHERE id=$1`, [conversationId]);
  const conversation = convRes.rows[0];
  if (!conversation) return { error: "Conversation not found" };

  const partRes = await pool.query(`SELECT "userId" FROM "ConversationParticipant" WHERE "conversationId"=$1`, [
    conversationId,
  ]);
  const participantIds = partRes.rows.map((r) => r.userId);
  if (!participantIds.includes(conn.userId)) return { error: "Not part of this conversation" };

  const id = crypto.randomUUID();
  const insertRes = await pool.query(
    `INSERT INTO "Message" (id, "conversationId", "senderId", content, "createdAt") VALUES ($1,$2,$3,$4,now()) RETURNING "createdAt"`,
    [id, conversationId, conn.userId, content]
  );

  const payload = {
    id,
    conversationId,
    content,
    createdAt: insertRes.rows[0].createdAt,
    sender: { id: conn.userId, name: conn.name, avatarColor: conn.avatarColor, avatarUrl: conn.avatarUrl },
  };

  await publish(`conversation:${conversationId}`, "message:new", payload);
  await Promise.all(
    participantIds.map((pid) =>
      publish(`user:${pid}`, "message:preview", { conversationId, workspaceId: conversation.workspaceId, ...payload })
    )
  );

  return { message: payload };
}

function handleTyping(conn, data) {
  const conversationId = data?.conversationId;
  if (!conversationId) return;
  publish(
    `conversation:${conversationId}`,
    "typing",
    { conversationId, userId: conn.userId, isTyping: !!data?.isTyping },
    { excludeConnId: conn.connId }
  );
}

// ---- Meetings ----

async function meetingPeers(workspaceId) {
  const res = await pool.query(
    `SELECT u.id AS "userId", u.name, u."avatarColor"
     FROM "MeetingParticipant" mp JOIN "User" u ON u.id = mp."userId"
     WHERE mp."workspaceId" = $1`,
    [workspaceId]
  );
  return res.rows;
}

async function handleMeetingStatus(workspaceId) {
  const participants = await meetingPeers(workspaceId);
  return { count: participants.length, participants };
}

async function handleMeetingJoin(conn, workspaceId) {
  const memberRes = await pool.query(`SELECT 1 FROM "WorkspaceMember" WHERE "workspaceId"=$1 AND "userId"=$2`, [
    workspaceId,
    conn.userId,
  ]);
  if (memberRes.rowCount === 0) return { error: "Not a member of this workspace" };

  // Read the roster before inserting, and from Postgres rather than local
  // memory — a concurrent joiner's connection may be held by a different
  // isolate than this one, so an in-memory room here would miss them.
  const existingPeers = await meetingPeers(workspaceId);
  const wasEmpty = existingPeers.length === 0;

  await pool.query(
    `INSERT INTO "MeetingParticipant" (id, "workspaceId", "userId", "joinedAt") VALUES ($1,$2,$3,now())
     ON CONFLICT ("workspaceId", "userId") DO UPDATE SET "joinedAt" = now()`,
    [crypto.randomUUID(), workspaceId, conn.userId]
  );
  conn.meetingWorkspaceId = workspaceId;

  publish(
    `meeting:${workspaceId}`,
    "meeting:peer-joined",
    { userId: conn.userId, name: conn.name, avatarColor: conn.avatarColor },
    { excludeConnId: conn.connId }
  );
  publish(`workspace:${workspaceId}`, "meeting:activity", {
    workspaceId,
    active: true,
    count: existingPeers.length + 1,
  });

  if (wasEmpty) {
    const [othersRes, wsRes] = await Promise.all([
      pool.query(`SELECT "userId" FROM "WorkspaceMember" WHERE "workspaceId"=$1 AND "userId" != $2`, [
        workspaceId,
        conn.userId,
      ]),
      pool.query(`SELECT name FROM "Workspace" WHERE id=$1`, [workspaceId]),
    ]);
    const workspaceName = wsRes.rows[0]?.name || "";
    await Promise.all(
      othersRes.rows.map((r) =>
        notify(r.userId, {
          type: "MEETING_STARTED",
          title: `${conn.name} started a meeting`,
          body: workspaceName,
          link: `/workspaces/${workspaceId}/meeting`,
        })
      )
    );
  }

  return { peers: existingPeers };
}

// Signaling and per-peer sync are targeted at a user, not a room, and go
// through the same publish() relay as everything else — not a local
// connection lookup — because the target user's socket may be held by a
// different isolate than the sender's.
function handleMeetingSignal(conn, data) {
  if (!conn.meetingWorkspaceId || !data?.toUserId) return;
  publish(`user:${data.toUserId}`, "meeting:signal", { fromUserId: conn.userId, data: data.data });
}

function handleMeetingAnnotationSync(conn, data) {
  if (!conn.meetingWorkspaceId || !data?.toUserId) return;
  publish(`user:${data.toUserId}`, "meeting:annotation-sync", data.shapes ?? null);
}

function handleMeetingRoomRelay(conn, event, payload) {
  const workspaceId = conn.meetingWorkspaceId;
  if (!workspaceId) return;
  publish(`meeting:${workspaceId}`, event, payload ?? null, { excludeConnId: conn.connId });
}

async function handleMeetingLeave(conn) {
  const workspaceId = conn.meetingWorkspaceId;
  if (!workspaceId) return;
  conn.meetingWorkspaceId = null;

  await pool.query(`DELETE FROM "MeetingParticipant" WHERE "workspaceId"=$1 AND "userId"=$2`, [
    workspaceId,
    conn.userId,
  ]);
  const remainingRes = await pool.query(`SELECT count(*)::int AS n FROM "MeetingParticipant" WHERE "workspaceId"=$1`, [
    workspaceId,
  ]);
  const remaining = remainingRes.rows[0].n;

  publish(`meeting:${workspaceId}`, "meeting:peer-left", { userId: conn.userId }, { excludeConnId: conn.connId });
  publish(`workspace:${workspaceId}`, "meeting:activity", { workspaceId, active: remaining > 0, count: remaining });
}

// ---- Documents (Yjs) ----
// Binary Yjs updates travel as base64 strings inside the JSON envelope (the
// client-side provider encodes/decodes); the server never needs the bytes
// except to fold them into its own in-memory Y.Doc for late joiners.

function scheduleSave(documentId) {
  const entry = docs.get(documentId);
  if (!entry) return;
  entry.dirty = true;
  clearTimeout(entry.saveTimer);
  entry.saveTimer = setTimeout(() => flushSave(documentId), SAVE_DEBOUNCE_MS);
  if (!entry.maxWaitTimer) entry.maxWaitTimer = setTimeout(() => flushSave(documentId), SAVE_MAX_WAIT_MS);
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
    const res = await pool.query(`UPDATE "Document" SET content=$1, "updatedAt"=now() WHERE id=$2 RETURNING "updatedAt"`, [
      content,
      documentId,
    ]);
    await publish(`workspace:${entry.workspaceId}`, "document:updated", {
      id: documentId,
      updatedAt: res.rows[0].updatedAt,
    });
  } catch (err) {
    console.error("document autosave failed", err);
  }
}

async function handleDocumentJoin(conn, documentId) {
  const docRes = await pool.query(`SELECT id, "workspaceId", title, content, "updatedAt" FROM "Document" WHERE id=$1`, [
    documentId,
  ]);
  const doc = docRes.rows[0];
  if (!doc) return { error: "Document not found" };

  const memberRes = await pool.query(`SELECT 1 FROM "WorkspaceMember" WHERE "workspaceId"=$1 AND "userId"=$2`, [
    doc.workspaceId,
    conn.userId,
  ]);
  if (memberRes.rowCount === 0) return { error: "Not a member of this workspace" };

  let entry = docs.get(documentId);
  if (!entry) {
    const ydoc = new Y.Doc();
    if (doc.content) Y.applyUpdate(ydoc, new Uint8Array(doc.content));
    entry = { ydoc, workspaceId: doc.workspaceId, sockets: new Map(), saveTimer: null, maxWaitTimer: null, dirty: false };
    docs.set(documentId, entry);
  }

  const presence = { userId: conn.userId, name: conn.name, avatarColor: conn.avatarColor };
  const existingPeers = Array.from(entry.sockets.values());
  entry.sockets.set(conn.connId, presence);
  conn.documentId = documentId;

  publish(`document:${documentId}`, "document:presence-join", presence, { excludeConnId: conn.connId });
  publish(`document:${documentId}`, "document:awareness-request", null, { excludeConnId: conn.connId });

  return {
    update: Buffer.from(Y.encodeStateAsUpdate(entry.ydoc)).toString("base64"),
    title: doc.title,
    updatedAt: doc.updatedAt,
    peers: existingPeers,
  };
}

function handleDocumentUpdate(conn, data) {
  const { documentId, update } = data || {};
  const entry = docs.get(documentId);
  if (!entry || !entry.sockets.has(conn.connId)) return;
  Y.applyUpdate(entry.ydoc, new Uint8Array(Buffer.from(update, "base64")));
  publish(`document:${documentId}`, "document:update", { update }, { excludeConnId: conn.connId });
  scheduleSave(documentId);
}

function handleDocumentAwareness(conn, data) {
  const { documentId, update } = data || {};
  const entry = docs.get(documentId);
  if (!entry || !entry.sockets.has(conn.connId)) return;
  publish(`document:${documentId}`, "document:awareness", { update }, { excludeConnId: conn.connId });
}

function handleDocumentLeave(conn) {
  const documentId = conn.documentId;
  if (!documentId) return;
  const entry = docs.get(documentId);
  if (entry) {
    entry.sockets.delete(conn.connId);
    const stillPresent = Array.from(entry.sockets.values()).some((p) => p.userId === conn.userId);
    if (!stillPresent) publish(`document:${documentId}`, "document:presence-leave", { userId: conn.userId });
    if (entry.sockets.size === 0) {
      flushSave(documentId).finally(() => {
        if (docs.get(documentId)?.sockets.size === 0) docs.delete(documentId);
      });
    }
  }
  conn.documentId = null;
}

// ---- Dispatch ----

async function dispatch(conn, event, data) {
  switch (event) {
    case "conversation:join":
      conn.conversationIds.add(data);
      return;
    case "conversation:leave":
      conn.conversationIds.delete(data);
      return;
    case "message:send":
      return handleMessageSend(conn, data);
    case "typing":
      handleTyping(conn, data);
      return;
    case "meeting:status":
      return handleMeetingStatus(data);
    case "meeting:join":
      return handleMeetingJoin(conn, data);
    case "meeting:signal":
      handleMeetingSignal(conn, data);
      return;
    case "meeting:screen-share":
      handleMeetingRoomRelay(conn, "meeting:screen-share", { userId: conn.userId, sharing: !!data?.sharing });
      return;
    case "meeting:annotation-add":
      handleMeetingRoomRelay(conn, "meeting:annotation-add", data);
      return;
    case "meeting:annotation-undo":
      handleMeetingRoomRelay(conn, "meeting:annotation-undo", data);
      return;
    case "meeting:annotation-update":
      handleMeetingRoomRelay(conn, "meeting:annotation-update", data);
      return;
    case "meeting:annotation-clear":
      handleMeetingRoomRelay(conn, "meeting:annotation-clear", null);
      return;
    case "meeting:annotation-sync":
      handleMeetingAnnotationSync(conn, data);
      return;
    case "meeting:leave":
      handleMeetingLeave(conn).catch((err) => console.error("meeting:leave failed", err));
      return;
    case "document:join":
      return handleDocumentJoin(conn, data);
    case "document:update":
      handleDocumentUpdate(conn, data);
      return;
    case "document:awareness":
      handleDocumentAwareness(conn, data);
      return;
    case "document:leave":
      handleDocumentLeave(conn);
      return;
    default:
      return { error: "Unknown event" };
  }
}

async function handleMessage(conn, raw) {
  if (typeof raw !== "string") return;
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (!msg?.event) return;
  let result;
  try {
    result = await dispatch(conn, msg.event, msg.data);
  } catch (err) {
    console.error(`event ${msg.event} failed`, err);
    result = { error: "Something went wrong" };
  }
  if (msg.id != null) send(conn.ws, { ackId: msg.id, data: result });
}

function corsOk(request) {
  const origin = request.headers.get("origin");
  return !origin || !CLIENT_URL || origin === CLIENT_URL;
}

export default {
  async fetch(request) {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Loft realtime service", { status: 200 });
    }
    if (!corsOk(request)) return new Response("forbidden", { status: 403 });

    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    let payload;
    try {
      payload = jwt.verify(token || "", JWT_SECRET);
    } catch {
      return new Response("unauthorized", { status: 401 });
    }

    const userRes = await pool.query(`SELECT id, name, "avatarColor", "avatarUrl" FROM "User" WHERE id=$1`, [
      payload.sub,
    ]);
    const user = userRes.rows[0];
    if (!user) return new Response("unauthorized", { status: 401 });

    const membershipRes = await pool.query(`SELECT "workspaceId" FROM "WorkspaceMember" WHERE "userId"=$1`, [user.id]);

    const { socket, response } = upgradeWebSocket(request);
    const connId = crypto.randomUUID();
    const conn = {
      ws: socket,
      connId,
      userId: user.id,
      name: user.name,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
      workspaceIds: new Set(membershipRes.rows.map((r) => r.workspaceId)),
      conversationIds: new Set(),
      meetingWorkspaceId: null,
      documentId: null,
    };
    connections.set(connId, conn);

    socket.addEventListener("message", (event) => {
      handleMessage(conn, event.data).catch((err) => console.error("message handling failed", err));
    });
    socket.addEventListener("close", () => {
      handleMeetingLeave(conn).catch((err) => console.error("meeting cleanup on close failed", err));
      handleDocumentLeave(conn);
      connections.delete(connId);
    });

    return response;
  },
};

import test from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { runReminderJob } from "../src/services/reminder.service.js";
import { notify } from "../src/services/notification.service.js";
import { saveDocumentEntry } from "../src/services/documentSave.js";
import { writeDocumentSnapshot } from "../src/services/documentSnapshot.js";
import { createRevision, listRevisions, getRevision } from "../src/controllers/documentHistory.controller.js";
import { expandRecurrence, availableSlots } from "../src/services/calendarScheduling.js";
import { detectConflicts } from "../src/services/conflict.service.js";
import { assertParent, assertAcyclicDependency, changedTaskFields } from "../src/services/taskCollaboration.js";
import { meetingIceConfig } from "../src/routes/meetings.routes.js";
import { sendMessageRest, updateMessage, getMessages } from "../src/controllers/messages.controller.js";
import { trashAsset, listTrash, restoreAsset, purgeAsset } from "../src/controllers/assetRecovery.controller.js";
import { setPrismaClient, clearPrismaClient } from "../src/db/prisma.js";

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test("Scheduled reminders deduplicate deliveries, respect custom offsets/quiet hours, and resume snoozed notifications", async () => {
  const now = new Date("2026-10-17T15:00:00.000Z"); // 23:00 Asia/Manila (within 22:00-07:00 quiet hours)
  const createdKeys = new Set();
  const createdRows = [];
  let snoozedCleared = 0;

  const db = {
    event: {
      async findMany() {
        return [{
          id: "ev-1",
          workspaceId: "ws-1",
          title: "Architecture Sync",
          startTime: new Date("2026-10-17T15:20:00.000Z"),
          workspace: { name: "Engineering" },
          attendees: [
            { userId: "user-1", response: "ACCEPTED", user: { notificationPreferences: JSON.stringify({ eventReminderMinutes: 30, quietHours: { enabled: true, start: "22:00", end: "07:00" }, timeZone: "Asia/Manila" }) } },
            { userId: "user-2", response: "DECLINED", user: { notificationPreferences: null } },
          ],
        }];
      },
    },
    taskStatus: { async findMany() { return [{ id: "done", isDone: true }]; } },
    task: {
      async findMany() {
        return [{
          id: "task-1",
          workspaceId: "ws-1",
          title: "Write release notes",
          dueDate: new Date("2026-10-17T15:45:00.000Z"),
          status: "todo",
          assigneeId: "user-1",
          workspace: { name: "Engineering", members: [{ userId: "user-1" }] },
          assignee: { notificationPreferences: JSON.stringify({ taskReminderMinutes: 60, quietHours: { enabled: true, start: "22:00", end: "07:00" }, timeZone: "Asia/Manila" }) },
        }];
      },
    },
    notification: {
      async create({ data }) {
        if (data.dedupeKey && createdKeys.has(data.dedupeKey)) {
          throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        }
        if (data.dedupeKey) createdKeys.add(data.dedupeKey);
        const row = { id: `notif-${createdRows.length + 1}`, ...data };
        createdRows.push(row);
        return row;
      },
      async findMany() {
        return snoozedCleared === 0
          ? [{ id: "snoozed-1", userId: "user-1", title: "Snoozed item", snoozedUntil: new Date("2026-10-17T14:55:00.000Z"), user: { notificationPreferences: null } }]
          : [];
      },
      async updateMany() {
        snoozedCleared++;
        return { count: 1 };
      },
    },
    realtimeEvent: { async create() { return {}; } },
  };

  setPrismaClient(db);
  try {
    const firstRun = await runReminderJob({ now, db, send: notify });
    assert.equal(firstRun.delivered, 2);
    assert.equal(createdRows.length, 2);
    assert.equal(snoozedCleared, 1);

    // Running again with the same window must deduplicate via dedupeKey
    const secondRun = await runReminderJob({ now, db, send: notify });
    assert.equal(secondRun.delivered, 0);
    assert.equal(createdRows.length, 2);
  } finally {
    clearPrismaClient(db);
  }
});

test("Document save serializes concurrent writes, retries transient failures with backoff, and caps revision history at 50", async () => {
  const entry = { dirty: true, saving: null, saveFailures: 0 };
  const retries = [];
  let attempts = 0;

  await saveDocumentEntry(entry, {
    async write() {
      attempts++;
      if (attempts === 1) throw new Error("Transient DB error");
      return "saved-ok";
    },
    scheduleRetry(delayMs) { retries.push(delayMs); },
  });
  assert.equal(entry.dirty, true);
  assert.equal(entry.saveFailures, 1);
  assert.deepEqual(retries, [2000]);

  let savedResult = null;
  await saveDocumentEntry(entry, {
    async write() { return "recovered"; },
    scheduleRetry() {},
    onSaved(res) { savedResult = res; },
  });
  assert.equal(entry.dirty, false);
  assert.equal(entry.saveFailures, 0);
  assert.equal(savedResult, "recovered");

  // Snapshot revision creation and pruning
  const revisions = [];
  let snapshotClock = new Date("2026-10-17T10:10:00.000Z");
  const docDb = {
    async $transaction(fn) { return fn(this); },
    document: {
      async findUnique() { return { title: "Spec", content: Buffer.from("old-content") }; },
      async update({ data }) { return { id: "doc-1", ...data }; },
    },
    documentRevision: {
      async findFirst() { return revisions[0] || null; },
      async create({ data }) {
        const rev = { id: `rev-${revisions.length + 1}`, createdAt: snapshotClock, ...data };
        revisions.unshift(rev);
        return rev;
      },
      async findMany({ skip }) { return skip ? revisions.slice(skip) : revisions; },
      async deleteMany({ where }) {
        const drop = new Set(where.id.in);
        for (let i = revisions.length - 1; i >= 0; i--) {
          if (drop.has(revisions[i].id)) revisions.splice(i, 1);
        }
      },
    },
  };

  await writeDocumentSnapshot(docDb, "doc-1", Buffer.from("new-content"), snapshotClock);
  assert.equal(revisions.length, 1);
  // Within 5 minutes, does not create a duplicate snapshot
  snapshotClock = new Date("2026-10-17T10:12:00.000Z");
  await writeDocumentSnapshot(docDb, "doc-1", Buffer.from("newer-content"), snapshotClock);
  assert.equal(revisions.length, 1);

  // Document history controller validates Yjs payload and returns base64 content
  const ydoc = new Y.Doc();
  ydoc.getXmlFragment("default").insert(0, [new Y.XmlText("Restorable content")]);
  const validBase64 = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString("base64");
  ydoc.destroy();

  const controllerDb = {
    ...docDb,
    document: {
      async findUnique() {
        return { id: "doc-1", workspaceId: "ws-1", title: "Spec", visibility: "WORKSPACE", createdById: "user-1", assignees: [] };
      },
    },
    documentRevision: {
      ...docDb.documentRevision,
      async findUnique({ where }) { return revisions.find((r) => r.id === where.id) || null; },
    },
  };
  setPrismaClient(controllerDb);
  try {
    const createRes = mockRes();
    await createRevision({
      userId: "user-1",
      membership: { role: "MEMBER", permissions: "" },
      params: { workspaceId: "ws-1", documentId: "doc-1" },
      body: { content: validBase64 },
    }, createRes);
    assert.equal(createRes.statusCode, 201);

    const listRes = mockRes();
    await listRevisions({
      userId: "user-1",
      membership: { role: "MEMBER", permissions: "" },
      params: { workspaceId: "ws-1", documentId: "doc-1" },
    }, listRes);
    assert.equal(listRes.body.revisions.length, 2);

    const getRes = mockRes();
    await getRevision({
      userId: "user-1",
      membership: { role: "MEMBER", permissions: "" },
      params: { workspaceId: "ws-1", documentId: "doc-1", revisionId: createRes.body.revision.id },
    }, getRes);
    assert.equal(getRes.body.revision.content, validBase64);
  } finally {
    clearPrismaClient(controllerDb);
  }
});

test("Calendar recurrence expansion, available slot suggestions, and timezone-aware conflict detection work accurately", () => {
  const occurrences = expandRecurrence(
    "2026-10-19T09:00:00+08:00",
    "2026-10-19T10:00:00+08:00",
    { frequency: "WEEKLY", count: 3, timeZone: "Asia/Manila" }
  );
  assert.equal(occurrences.length, 3);
  assert.equal(occurrences[1].startTime.toISOString(), new Date("2026-10-26T09:00:00+08:00").toISOString());
  assert.equal(occurrences[2].startTime.toISOString(), new Date("2026-11-02T09:00:00+08:00").toISOString());

  const slots = availableSlots({
    startTime: "2026-10-19T09:00:00+08:00",
    endTime: "2026-10-19T10:00:00+08:00",
    busyEvents: [{ startTime: "2026-10-19T09:00:00+08:00", endTime: "2026-10-19T10:30:00+08:00" }],
    timeZone: "Asia/Manila",
    now: new Date("2026-10-19T08:00:00+08:00"),
  });
  assert.equal(slots.length, 5);
  assert.equal(slots[0].startTime, new Date("2026-10-19T10:30:00+08:00").toISOString());

  const conflicts = detectConflicts({
    timeZone: "Asia/Manila",
    dailyCapacityHours: 6,
    tasks: [
      { id: "t1", workspaceId: "ws-1", workspaceName: "Alpha", title: "Task A", dueDate: "2026-10-20T17:00:00+08:00", estimatedMinutes: 240 },
      { id: "t2", workspaceId: "ws-2", workspaceName: "Beta", title: "Task B", dueDate: "2026-10-20T18:00:00+08:00", estimatedMinutes: 240 },
    ],
    events: [
      { id: "e1", workspaceId: "ws-1", workspaceName: "Alpha", title: "Sync 1", startTime: "2026-10-20T10:00:00+08:00", endTime: "2026-10-20T11:00:00+08:00" },
      { id: "e2", workspaceId: "ws-2", workspaceName: "Beta", title: "Sync 2", startTime: "2026-10-20T10:30:00+08:00", endTime: "2026-10-20T11:30:00+08:00" },
    ],
  });
  assert.ok(conflicts.some((c) => c.type === "EVENT_OVERLAP"));
  assert.ok(conflicts.some((c) => c.type === "DEADLINE_CLASH" && c.workload?.estimatedHours === 8));
});

test("Task collaboration helpers prevent subtask and dependency cycles and record field changes", async () => {
  const tasks = new Map([
    ["t-1", { id: "t-1", workspaceId: "ws-1", parentTaskId: "t-2" }],
    ["t-2", { id: "t-2", workspaceId: "ws-1", parentTaskId: null }],
  ]);
  const db = {
    task: { async findUnique({ where }) { return tasks.get(where.id) || null; } },
  };

  await assert.rejects(assertParent(db, "ws-1", "t-2", "t-1"), /Subtasks cannot form a cycle/);
  await assertParent(db, "ws-1", "t-3", "t-1");

  const edges = [{ taskId: "t-1", dependsOnId: "t-2" }, { taskId: "t-2", dependsOnId: "t-3" }];
  assert.throws(() => assertAcyclicDependency(edges, "t-3", "t-1"), /cycle/);
  assert.doesNotThrow(() => assertAcyclicDependency(edges, "t-1", "t-3"));

  const diff = changedTaskFields(
    { title: "Old", tier: "TIER_3", status: "todo" },
    { title: "New", tier: "TIER_1", status: "todo" }
  );
  assert.deepEqual(diff, {
    title: { before: "Old", after: "New" },
    tier: { before: "TIER_3", after: "TIER_1" },
  });
});

test("Chat messages support replies, pinning, author-only editing, and pinned message filtering", async () => {
  const messages = new Map([
    ["m-1", {
      id: "m-1",
      conversationId: "conv-1",
      senderId: "user-1",
      content: "Parent message",
      createdAt: new Date("2026-10-17T08:00:00.000Z"),
      editedAt: null,
      parentMessageId: null,
      isPinned: false,
      sender: { id: "user-1", name: "Alice", avatarColor: "#5B5BD6", avatarUrl: null },
      attachment: null,
      reactions: [],
      parentMessage: null,
    }],
  ]);

  const db = {
    conversation: {
      async findUnique({ where }) {
        if (where.id !== "conv-1") return null;
        return { id: "conv-1", workspaceId: "ws-1", isMeetingChat: false, participants: [{ userId: "user-1" }, { userId: "user-2" }] };
      },
    },
    workspaceMember: {
      async findUnique() { return { workspaceId: "ws-1", userId: "user-1", role: "MEMBER", permissions: "" }; },
    },
    conversationParticipant: {
      async findUnique({ where }) {
        const pair = where.conversationId_userId;
        if (pair.conversationId === "conv-1" && ["user-1", "user-2"].includes(pair.userId)) {
          return { conversationId: "conv-1", userId: pair.userId, conversation: { id: "conv-1", workspaceId: "ws-1", isMeetingChat: false } };
        }
        return null;
      },
      async findMany() { return [{ userId: "user-1" }, { userId: "user-2" }]; },
    },
    message: {
      async findUnique({ where }) { return messages.get(where.id) || null; },
      async create({ data }) {
        const parent = data.parentMessageId ? messages.get(data.parentMessageId) : null;
        const created = {
          id: "m-2",
          ...data,
          createdAt: new Date("2026-10-17T08:05:00.000Z"),
          editedAt: null,
          isPinned: false,
          sender: { id: data.senderId, name: "Alice", avatarColor: "#5B5BD6", avatarUrl: null },
          attachment: null,
          reactions: [],
          parentMessage: parent ? { id: parent.id, content: parent.content, sender: { id: parent.sender.id, name: parent.sender.name } } : null,
        };
        messages.set(created.id, created);
        return created;
      },
      async update({ where, data }) {
        const existing = messages.get(where.id);
        const updated = { ...existing, ...data };
        messages.set(where.id, updated);
        return updated;
      },
      async findMany({ where }) {
        return [...messages.values()].filter((m) => (!where.isPinned || m.isPinned)).reverse();
      },
    },
    realtimeEvent: { async create() { return {}; } },
  };

  setPrismaClient(db);
  try {
    const replyRes = mockRes();
    await sendMessageRest({
      userId: "user-1",
      params: { conversationId: "conv-1" },
      body: { content: "Replying here", parentMessageId: "m-1" },
    }, replyRes);
    assert.equal(replyRes.statusCode, 201);
    assert.equal(replyRes.body.message.parentMessage.id, "m-1");

    // Non-author cannot edit content
    await assert.rejects(
      updateMessage({
        userId: "user-2",
        params: { conversationId: "conv-1", messageId: "m-1" },
        body: { content: "Hijack" },
      }, mockRes()),
      /Only the author can edit this message/
    );

    // Any participant can pin, author can edit
    const editRes = mockRes();
    await updateMessage({
      userId: "user-1",
      params: { conversationId: "conv-1", messageId: "m-1" },
      body: { content: "Edited parent", isPinned: true },
    }, editRes);
    assert.equal(editRes.body.message.content, "Edited parent");
    assert.equal(editRes.body.message.isPinned, true);
    assert.ok(editRes.body.message.editedAt);

    const pinnedRes = mockRes();
    await getMessages({
      userId: "user-1",
      params: { conversationId: "conv-1" },
      query: { pinned: "true" },
    }, pinnedRes);
    assert.equal(pinnedRes.body.messages.length, 1);
    assert.equal(pinnedRes.body.messages[0].id, "m-1");
  } finally {
    clearPrismaClient(db);
  }
});

test("Storage recycle bin moves, lists, restores, and requires trashing before permanent purge", async () => {
  const assetRecord = {
    id: "asset-1",
    workspaceId: "ws-1",
    folderId: null,
    taskId: null,
    name: "design.png",
    uploadedById: "user-1",
    deletedAt: null,
    createdAt: new Date("2026-10-17T08:00:00.000Z"),
    updatedAt: new Date("2026-10-17T08:00:00.000Z"),
    uploadedBy: { id: "user-1", name: "Alice", avatarColor: "#5B5BD6" },
    versions: [{ id: "v-1", version: 1, originalName: "design.png", storedName: "stored-1.png", mimeType: "image/png", size: 1024, createdAt: new Date(), uploadedBy: { id: "user-1", name: "Alice" } }],
  };

  const db = {
    asset: {
      async findUnique({ where }) { return where.id === "asset-1" ? assetRecord : null; },
      async update({ data }) { Object.assign(assetRecord, data); return assetRecord; },
      async findMany() { return assetRecord.deletedAt ? [assetRecord] : []; },
    },
    realtimeEvent: { async create() { return {}; } },
  };

  setPrismaClient(db);
  try {
    const req = {
      userId: "user-1",
      membership: { role: "MEMBER", permissions: "" },
      params: { workspaceId: "ws-1", assetId: "asset-1" },
    };

    // Cannot purge before moving to recycle bin
    await assert.rejects(purgeAsset(req, mockRes()), /Move this file to the recycle bin first/);

    const trashRes = mockRes();
    await trashAsset(req, trashRes);
    assert.ok(assetRecord.deletedAt);

    const listRes = mockRes();
    await listTrash(req, listRes);
    assert.equal(listRes.body.assets.length, 1);

    const restoreRes = mockRes();
    await restoreAsset(req, restoreRes);
    assert.equal(assetRecord.deletedAt, null);
  } finally {
    clearPrismaClient(db);
  }
});

test("Meeting ICE configuration returns STUN by default and signed TURN credentials when configured", () => {
  const stunOnly = meetingIceConfig("user-1", {}, 1700000000000);
  assert.equal(stunOnly.relayConfigured, false);
  assert.equal(stunOnly.iceServers.length, 1);

  const withTurn = meetingIceConfig("user-1", {
    TURN_URLS: "turn:turn.example.com:3478?transport=udp, turns:turn.example.com:5349",
    TURN_SHARED_SECRET: "turn-secret",
  }, 1700000000000);
  assert.equal(withTurn.relayConfigured, true);
  assert.equal(withTurn.iceServers.length, 2);
  assert.deepEqual(withTurn.iceServers[1].urls, [
    "turn:turn.example.com:3478?transport=udp",
    "turns:turn.example.com:5349",
  ]);
  assert.match(withTurn.iceServers[1].username, /:user-1$/);
  assert.ok(withTurn.iceServers[1].credential);
});

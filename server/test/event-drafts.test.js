import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { createMeetingDraft, listMeetingDrafts, updateMeetingDraft, deleteMeetingDraft, scheduleMeetingDraft } from "../src/services/eventDrafts.service.js";
import { createEventDraft, scheduleEventDraft } from "../src/controllers/eventDrafts.controller.js";
import { setPrismaClient, clearPrismaClient } from "../src/db/prisma.js";
import { createApp } from "../src/app.js";
import { signToken } from "../src/utils/jwt.js";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const manager = "33333333-3333-4333-8333-333333333333";
const outsider = "44444444-4444-4444-8444-444444444444";
const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const elsewhere = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const deferred = { title: "Planning", description: "Agenda to follow", location: "Room A", deferredFields: ["startTime", "endTime", "attendeeIds"] };
const ready = { title: "Planning", description: "Agenda", location: "Room A", startTime: "2026-10-09T10:00:00+08:00", endTime: "2026-10-09T11:00:00+08:00", attendeeIds: [owner, other, other] };

// An isolated database with rollback and serialized transactions exercises the
// service's persistence boundary without touching application records.
function database() {
  let drafts = new Map();
  let events = new Map();
  let queue = Promise.resolve();
  let failDelete = false;
  const membership = new Map([[owner, { role: "MEMBER" }], [other, { role: "MEMBER" }], [manager, { role: "MEMBER", permissions: "events.manage" }]]);
  const notifications = [];
  const pushes = [];
  const missing = () => Object.assign(new Error("Missing"), { code: "P2025" });
  const db = {
    workspaceMember: { async findUnique({ where: { workspaceId_userId: pair } }) { return pair.workspaceId === workspaceId ? membership.get(pair.userId) || null : null; } },
    eventDraft: {
      async create({ data }) { const id = data.id || randomUUID(); if (drafts.has(id)) throw Object.assign(new Error("Duplicate"), { code: "P2002" }); const row = { attendeeIds: null, deferredFields: "", ...data, id }; drafts.set(id, row); return row; },
      async findUnique({ where }) { return drafts.get(where.id) || null; },
      async findMany({ where, take }) { return [...drafts.values()].filter((d) => d.workspaceId === where.workspaceId && (!where.createdById || d.createdById === where.createdById)).slice(0, take); },
      async update({ where, data }) { if (!drafts.has(where.id)) throw missing(); const row = { ...drafts.get(where.id), ...data }; drafts.set(where.id, row); return row; },
      async delete({ where }) { if (failDelete) throw new Error("Delete failed"); if (!drafts.has(where.id)) throw missing(); drafts.delete(where.id); },
    },
    event: {
      async findUnique({ where }) { return events.get(where.id) || null; },
      async create({ data }) {
        if (events.has(data.id)) throw Object.assign(new Error("Duplicate"), { code: "P2002" });
        const event = { ...data, workspace: { name: "School", color: "green" }, attendees: data.attendees.create.map(({ userId }) => ({ user: { id: userId, name: userId } })) };
        events.set(data.id, event); return event;
      },
    },
    notification: { async create({ data }) { notifications.push(data); return { id: randomUUID(), ...data }; } },
    realtimeEvent: { async create({ data }) { pushes.push(data); return data; } },
    $transaction(callback) {
      const run = queue.then(async () => {
        const snapshot = { drafts: new Map(drafts), events: new Map(events) };
        try { return await callback(db); } catch (error) { drafts = snapshot.drafts; events = snapshot.events; throw error; }
      });
      queue = run.catch(() => {}); return run;
    },
  };
  return { db, membership, notifications, pushes, get drafts() { return drafts; }, get events() { return events; }, failDeletion() { failDelete = true; } };
}
const create = (fake, data = deferred, userId = owner) => createMeetingDraft({ userId, workspaceId, data }, fake.db);
const status = (code) => (e) => e.statusCode === code;
const response = () => ({ status() { return this; }, json(body) { this.body = body; } });

test("Saving and updating partial drafts preserves supplied details without inventing a schedule", async () => {
  const fake = database();
  const draft = await create(fake);
  assert.equal(draft.description, deferred.description);
  assert.equal(draft.location, deferred.location);
  assert.equal(draft.startTime, undefined);
  assert.deepEqual(draft.attendeeIds, []);
  const partial = await updateMeetingDraft(owner, workspaceId, draft.id, { startTime: ready.startTime }, fake.db);
  assert.equal(partial.startTime.toISOString(), "2026-10-09T02:00:00.000Z");
  assert.equal(partial.description, deferred.description);
  await assert.rejects(updateMeetingDraft(owner, workspaceId, draft.id, { endTime: "2026-10-09T09:00:00+08:00" }, fake.db), status(400));
  await assert.rejects(updateMeetingDraft(owner, workspaceId, draft.id, { attendeeIds: [outsider] }, fake.db), status(400));
  await assert.rejects(create(fake, { ...deferred, createdById: other }));
  assert.equal(fake.events.size, 0);
});

test("Draft ownership, workspace boundaries and live grants protect reads and mutations", async () => {
  const fake = database();
  const draft = await create(fake);
  await create(fake, { ...deferred, title: "Other draft" }, other);
  assert.equal((await listMeetingDrafts(owner, workspaceId, fake.db)).length, 1);
  assert.equal((await listMeetingDrafts(manager, workspaceId, fake.db)).length, 2);
  await assert.rejects(updateMeetingDraft(other, workspaceId, draft.id, { title: "Hijack" }, fake.db), status(403));
  await assert.rejects(deleteMeetingDraft(other, workspaceId, draft.id, fake.db), status(403));
  await assert.rejects(scheduleMeetingDraft(other, workspaceId, draft.id, ready, fake.db), status(403));
  fake.drafts.set("foreign", { ...draft, id: "foreign", workspaceId: elsewhere });
  await assert.rejects(scheduleMeetingDraft(manager, workspaceId, "foreign", ready, fake.db), status(404));
  await updateMeetingDraft(manager, workspaceId, draft.id, { title: "Managed" }, fake.db);
  fake.membership.get(manager).permissions = "";
  await assert.rejects(deleteMeetingDraft(manager, workspaceId, draft.id, fake.db), status(403));
  fake.membership.delete(owner);
  await assert.rejects(scheduleMeetingDraft(owner, workspaceId, draft.id, ready, fake.db), status(403));
  await assert.rejects(listMeetingDrafts(owner, workspaceId, fake.db), status(403));
});

test("Scheduling needs complete valid details and remains atomic when draft removal fails", async () => {
  const fake = database();
  const draft = await create(fake);
  for (const invalid of [{ ...ready, startTime: null }, { ...ready, attendeeIds: [] }, { ...ready, endTime: ready.startTime }, { ...ready, attendeeIds: [outsider] }]) {
    await assert.rejects(scheduleMeetingDraft(owner, workspaceId, draft.id, invalid, fake.db));
    assert.equal(fake.events.size, 0);
    assert.equal(fake.drafts.size, 1);
  }
  fake.failDeletion();
  await assert.rejects(scheduleMeetingDraft(owner, workspaceId, draft.id, ready, fake.db), /Delete failed/);
  assert.equal(fake.events.size, 0);
  assert.equal(fake.drafts.size, 1);
});

test("Concurrent scheduling and retries create one event with deduplicated attendees", async () => {
  const fake = database();
  const draft = await create(fake);
  const results = await Promise.all([scheduleMeetingDraft(owner, workspaceId, draft.id, ready, fake.db), scheduleMeetingDraft(owner, workspaceId, draft.id, ready, fake.db)]);
  assert.deepEqual(results.map((r) => r.alreadyScheduled), [false, true]);
  assert.equal(fake.events.size, 1);
  assert.equal(fake.drafts.size, 0);
  assert.equal(results[0].event.id, draft.id);
  assert.equal(results[0].event.attendees.length, 2);
  assert.equal(results[0].event.createdById, owner);
  const retry = await scheduleMeetingDraft(owner, workspaceId, draft.id, { ...ready, title: "Must not overwrite" }, fake.db);
  assert.equal(retry.event.title, "Planning");
  await assert.rejects(scheduleMeetingDraft(other, workspaceId, draft.id, ready, fake.db), status(403));
});

test("Draft saves send no invitations or calendar event; only scheduling notifies once", async (t) => {
  const fake = database();
  setPrismaClient(fake.db); t.after(() => clearPrismaClient(fake.db));
  const saved = response();
  await createEventDraft({ userId: owner, params: { workspaceId }, body: deferred }, saved);
  assert.equal(fake.notifications.length, 0);
  assert.equal(fake.events.size, 0);
  assert.equal(fake.pushes.length, 1);
  assert.equal(fake.pushes[0].event, "event:draft-created");
  assert.deepEqual(JSON.parse(fake.pushes[0].payload), { id: saved.body.draft.id });
  const req = { userId: owner, params: { workspaceId, draftId: saved.body.draft.id }, body: ready };
  await scheduleEventDraft(req, response());
  await scheduleEventDraft(req, response());
  assert.equal(fake.notifications.length, 1);
  assert.equal(fake.notifications[0].userId, other);
  assert.equal(fake.pushes.filter((p) => p.event === "event:created").length, 1);
});

test("HTTP draft routes enforce authentication and ownership while scheduled edits retain events.manage", async (t) => {
  process.env.JWT_SECRET = "drafts-test-secret-only";
  const fake = database();
  setPrismaClient(fake.db);
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); clearPrismaClient(fake.db); });
  const url = `http://127.0.0.1:${server.address().port}/api/workspaces/${workspaceId}/events`;
  const request = (path, method = "GET", userId = owner, data) => fetch(`${url}${path}`, { method, headers: { "Content-Type": "application/json", ...(userId ? { Authorization: `Bearer ${signToken({ sub: userId })}` } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  assert.equal((await request("/drafts", "GET", null)).status, 401);
  assert.equal((await request("/drafts", "GET", outsider)).status, 403);
  assert.equal((await request("/drafts", "POST", owner, { ...deferred, userId: other })).status, 400);
  const saved = await request("/drafts", "POST", owner, deferred);
  assert.equal(saved.status, 201);
  const { draft } = await saved.json();
  assert.equal((await request(`/drafts/${draft.id}`, "PATCH", other, { title: "Hijack" })).status, 403);
  assert.deepEqual((await (await request("/drafts", "GET", other)).json()).drafts, []);
  assert.equal((await request(`/drafts/${draft.id}/schedule`, "POST", owner, ready)).status, 200);
  assert.equal((await request(`/${draft.id}`, "PATCH", owner, ready)).status, 403);
  fake.membership.delete(owner);
  assert.equal((await request(`/drafts/${draft.id}/schedule`, "POST", owner, ready)).status, 403);
});

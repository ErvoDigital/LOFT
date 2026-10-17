import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { getPlanData } from "../src/services/planData.service.js";
import { recommendPlan, recommendationContext } from "../src/services/planRecommendations.service.js";
import { setPrismaClient, clearPrismaClient } from "../src/db/prisma.js";

const userId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const removed = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const urgentId = "22222222-2222-4222-8222-222222222222";
const mediumId = "33333333-3333-4333-8333-333333333333";
const now = new Date("2026-10-20T02:00:00Z");

function database() {
  const queries = [];
  const base = { workspaceId, workspace: { name: "Launch", color: "#000" }, assigneeId: userId, status: "todo", estimatedMinutes: 30, isPinned: false, isSnoozed: false, dueDate: new Date(now.getTime() + 3600000) };
  const tasks = [
    { ...base, id: urgentId, title: "Resolve launch issue", tier: "TIER_1" },
    { ...base, id: mediumId, title: "Prepare notes", tier: "TIER_3" },
    { ...base, id: "other-owner", assigneeId: "someone-else", title: "Someone else's task" },
    { ...base, id: "removed-task", workspaceId: removed, title: "Removed workspace secret" },
    { ...base, id: "done", status: "done", title: "Finished task" },
    { ...base, id: "legacy-done", status: "COMPLETED", title: "Legacy completed task" },
  ];
  const event = { id: "meeting", workspaceId, workspace: base.workspace, title: "Current meeting", startTime: new Date(now.getTime() - 600000), endTime: new Date(now.getTime() + 600000), attendeeIds: [userId] };
  const db = {
    user: { async findUnique({ where }) { return where.id === userId ? { id: userId, aiPriorityEnabled: fakeUser.aiPriorityEnabled } : null; }, async update({ where, data }) { assert.equal(where.id, userId); Object.assign(fakeUser, data); return { id: userId, ...fakeUser }; } },
    taskStatus: { async findMany(query) { queries.push(query); if (query.where.isDone) { assert.equal(query.where.workspace.members.some.userId, userId); return [{ id: "done" }]; } return [{ id: "todo", workspaceId, label: "To do", isDone: false }]; } },
    task: { async findMany(query) {
      queries.push(query);
      assert.equal(query.where.assigneeId, userId);
      assert.equal(query.where.workspace.members.some.userId, userId);
      return tasks.filter((task) => task.assigneeId === userId && task.workspaceId !== removed && !query.where.status.notIn.includes(task.status) && (!query.where.workspaceId || task.workspaceId === query.where.workspaceId));
    } },
    event: { async findMany(query) {
      queries.push(query);
      assert.equal(query.where.workspace.members.some.userId, userId);
      assert.equal(query.where.attendees.some.userId, userId);
      return event.endTime >= query.where.endTime.gte ? [event] : [];
    } },
  };
  const fakeUser = { aiPriorityEnabled: true };
  return { db, queries, tasks, fakeUser };
}

test("My Plan excludes finished, foreign-assignee and revoked-workspace tasks and includes current meetings", async () => {
  const fake = database();
  const plan = await getPlanData({ userId, now, dailyCapacityHours: 4 }, fake.db);
  assert.deepEqual(plan.tasks.map((task) => task.id), [urgentId, mediumId]);
  assert.equal(plan.dailyCapacityHours, 4);
  assert.equal(plan.events[0].title, "Current meeting");
  assert.equal(plan.generatedAt, now.toISOString());
  const context = recommendationContext(plan, { now, timeZone: "Asia/Manila" });
  assert.deepEqual(context.tasks.map((task) => task.priority), ["Urgent", "Medium"]);
  assert.doesNotMatch(JSON.stringify(context), /Removed workspace secret|Someone else's task|TIER_/);
});

test("Kas explains the verified plan with no tools, honors personal order and cannot return foreign tasks", async () => {
  const fake = database();
  const plan = await getPlanData({ userId, now }, fake.db);
  const options = { now, timeZone: "Asia/Manila", manual: { order: [mediumId, urgentId], dates: {} } };
  const result = await recommendPlan(plan, options, async ({ message, instructions, tools }) => {
    assert.deepEqual(tools, []);
    assert.match(instructions, /untrusted data/);
    const context = JSON.parse(message);
    assert.equal(context.tasks[0].taskId, mediumId);
    assert.equal(context.capacityHours, 6);
    return JSON.stringify({ summary: "Follow your chosen order.", rankedTaskIds: context.tasks.map((task) => task.taskId), items: context.tasks.map((task) => ({ taskId: task.taskId, reason: "Your chosen order, with Tier 3 priority.", nextStep: "Review the requirements and begin the task." })) });
  });
  assert.equal(result.items[0].title, "Prepare notes");
  assert.match(result.items[0].reason, /Medium priority/);
  assert.doesNotMatch(JSON.stringify(result), /TIER_|Tier 3/);
  for (const payload of ["invalid", JSON.stringify({ summary: "Wrong task", rankedTaskIds: [removed], items: [{ taskId: removed, reason: "Made up", nextStep: "Do it" }] }), JSON.stringify({ summary: "Wrong order", rankedTaskIds: [urgentId, mediumId], items: [{ taskId: urgentId, reason: "First", nextStep: "Review" }, { taskId: mediumId, reason: "Second", nextStep: "Review" }] })]) {
    await assert.rejects(recommendPlan(plan, options, async () => payload), (err) => err.statusCode === 502);
  }
  const snoozed = { ...plan, tasks: plan.tasks.map((task) => ({ ...task, isSnoozed: true })) };
  assert.deepEqual((await recommendPlan(snoozed, options, async () => assert.fail("Snoozed plan should not call a provider"))).items, []);
});

test("Plan recommendations require auth, validate edits, scope provider input and bound paid requests", async () => {
  process.env.JWT_SECRET = "plan-test-secret-only";
  const { createApp } = await import("../src/app.js");
  const { signToken } = await import("../src/utils/jwt.js");
  const previous = { url: process.env.OPENCLAW_GATEWAY_URL, token: process.env.OPENCLAW_GATEWAY_TOKEN };
  const fake = database(); setPrismaClient(fake.db);
  let calls = 0;
  let hold = false;
  let started;
  let release;
  const gateway = http.createServer(async (req, res) => {
    calls++;
    const body = JSON.parse(Buffer.concat(await Array.fromAsync(req)).toString());
    const context = JSON.parse(body.input.replace(/^user: /, ""));
    assert.deepEqual(body.tools, []);
    assert.doesNotMatch(JSON.stringify(context), /Removed workspace secret|Someone else's task/);
    if (hold) { started(); await new Promise((resolve) => { release = resolve; }); }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: "result", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ summary: "Start with the first task and review deadlines.", rankedTaskIds: context.tasks.map((task) => task.taskId), items: context.tasks.slice(0, 5).map((task) => ({ taskId: task.taskId, reason: "Priority and approaching deadline.", nextStep: "Review the task and start with its requirements." })) }) }] }] }));
  });
  const server = http.createServer(createApp());
  await Promise.all([new Promise((resolve) => gateway.listen(0, "127.0.0.1", resolve)), new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))]);
  process.env.OPENCLAW_GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.OPENCLAW_GATEWAY_TOKEN = "plan-test-gateway-token";
  const base = `http://127.0.0.1:${server.address().port}/api/plan`;
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + signToken({ sub: userId }) };
  const post = (body = {}) => fetch(base + "/recommendations", { method: "POST", headers, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(base + "/recommendations", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
    assert.equal((await post({ capacity: 100 })).status, 400);
    assert.equal((await post({ timeZone: "Not/AZone" })).status, 400);
    assert.equal((await post({ manual: { order: [], dates: { [urgentId]: "2026-02-30" } } })).status, 400);
    assert.equal((await post({ tasks: [{ id: removed }] })).status, 400);
    assert.equal(calls, 0);
    const data = await fetch(base + "?capacity=4", { headers });
    assert.equal((await data.json()).dailyCapacityHours, 4);
    const response = await post({ capacity: 4 });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).items[0].taskId, urgentId);
    assert.equal((await post({ capacity: 4 })).status, 200);
    assert.equal(calls, 1, "Identical automatic analyses reuse the cached result");
    const off = await fetch(base.replace("/plan", "/users/me"), { method: "PATCH", headers, body: JSON.stringify({ aiPriorityEnabled: false }) });
    assert.equal((await off.json()).user.aiPriorityEnabled, false);
    assert.equal((await (await post({ capacity: 10 })).json()).enabled, false);
    assert.equal(calls, 1, "Disabled personal setting prevents provider calls");
    const on = await fetch(base.replace("/plan", "/users/me"), { method: "PATCH", headers, body: JSON.stringify({ aiPriorityEnabled: true }) });
    assert.equal((await on.json()).user.aiPriorityEnabled, true);
    hold = true;
    const pendingStarted = new Promise((resolve) => { started = resolve; });
    const pending = post({ capacity: 3 }); await pendingStarted;
    assert.equal((await post({ capacity: 5 })).status, 429);
    release(); await pending; hold = false;
    for (const capacity of [6, 7, 8]) assert.equal((await post({ capacity })).status, 200);
    assert.equal((await post({ capacity: 9 })).status, 429);
    assert.equal(calls, 5);
  } finally {
    release?.(); server.closeAllConnections(); gateway.closeAllConnections();
    await Promise.all([new Promise((resolve) => server.close(resolve)), new Promise((resolve) => gateway.close(resolve))]);
    if (previous.url === undefined) delete process.env.OPENCLAW_GATEWAY_URL; else process.env.OPENCLAW_GATEWAY_URL = previous.url;
    if (previous.token === undefined) delete process.env.OPENCLAW_GATEWAY_TOKEN; else process.env.OPENCLAW_GATEWAY_TOKEN = previous.token;
    clearPrismaClient(fake.db);
  }
});

test("AI priority analysis can change the baseline ranking while rejecting duplicate, foreign or unpinned-first orders", async () => {
  const fake = database();
  const plan = await getPlanData({ userId, now }, fake.db);
  const answer = (order) => JSON.stringify({ summary: "Start with the short preparation task.", rankedTaskIds: order, items: order.slice(0, 5).map((taskId) => ({ taskId, reason: "Based on task details and the available effort estimate.", nextStep: "Review the requirements and begin." })) });
  const result = await recommendPlan(plan, { now }, async ({ instructions }) => {
    assert.match(instructions, /may reorder the baseline ranking/);
    return answer([mediumId, urgentId]);
  });
  assert.deepEqual(result.order, [mediumId, urgentId]);
  assert.equal(result.items[0].title, "Prepare notes");
  for (const order of [[mediumId, mediumId], [mediumId, removed]]) await assert.rejects(recommendPlan(plan, { now }, async () => answer(order)), (err) => err.statusCode === 502);
  plan.tasks[0].isPinned = true;
  plan.tasks[0].dueDate = new Date(now.getTime() + 86400000);
  assert.equal(recommendationContext(plan, { now, maxTasks: 1 }).tasks[0].taskId, urgentId);
  await assert.rejects(recommendPlan(plan, { now }, async () => answer([mediumId, urgentId])), /pinned tasks/);
});

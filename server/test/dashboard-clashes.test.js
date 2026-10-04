import { after, describe, it } from "node:test";
import assert from "node:assert/strict";

import { clearPrismaClient, setPrismaClient } from "../src/db/prisma.js";
import { getDashboard } from "../src/controllers/dashboard.controller.js";

// Who sees which clash on the dashboard: an admin sees every clash in the
// workspaces they run, a member only the ones their own tasks and meetings
// are part of.

// Days from today, in local time — conflict detection compares calendar days
// locally, and the dashboard only looks two weeks ahead for meetings.
const today = new Date();
const day = (n, hour = 9) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n, hour);

const workspaces = [
  { id: "ws-a", name: "Alpha", type: "work", color: "#000", createdAt: day(1) },
  { id: "ws-b", name: "Beta", type: "work", color: "#000", createdAt: day(2) },
];

// admin runs both workspaces; member is a plain member of both; mixed runs
// Alpha but is only a member of Beta.
const memberships = [
  { workspaceId: "ws-a", userId: "admin", role: "ADMIN" },
  { workspaceId: "ws-b", userId: "admin", role: "ADMIN" },
  { workspaceId: "ws-a", userId: "member", role: "MEMBER" },
  { workspaceId: "ws-b", userId: "member", role: "MEMBER" },
  { workspaceId: "ws-a", userId: "mixed", role: "ADMIN" },
  { workspaceId: "ws-b", userId: "mixed", role: "MEMBER" },
];

const tasks = [
  // Two other people's deadlines that collide on day 3, plus the mixed
  // user's own Beta task landing the same day.
  { id: "t-other-a", workspaceId: "ws-a", title: "Other A", assigneeId: "someone", dueDate: day(3) },
  { id: "t-other-b", workspaceId: "ws-b", title: "Other B", assigneeId: "someone-else", dueDate: day(3) },
  { id: "t-mixed-b", workspaceId: "ws-b", title: "Mixed B", assigneeId: "mixed", dueDate: day(3) },
  // The member's own deadlines, colliding on day 5.
  { id: "t-member-a", workspaceId: "ws-a", title: "Member A", assigneeId: "member", dueDate: day(5) },
  { id: "t-member-b", workspaceId: "ws-b", title: "Member B", assigneeId: "member", dueDate: day(5) },
].map((t) => ({ tier: "TIER_3", status: "TODO", ...t }));

const events = [
  // Overlapping meetings on day 7; the member only attends the Alpha one.
  { id: "e-a", workspaceId: "ws-a", title: "Alpha sync", startTime: day(7, 9), endTime: day(7, 10), attendeeIds: ["member", "admin"] },
  { id: "e-b", workspaceId: "ws-b", title: "Beta sync", startTime: day(7, 9), endTime: day(7, 10), attendeeIds: ["admin"] },
];

function matches(row, where = {}) {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return cond.some((branch) => matches(row, branch));
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond) return cond.in.includes(row[key]);
      if ("notIn" in cond) return !cond.notIn.includes(row[key]);
      if ("not" in cond) return row[key] !== cond.not;
      if ("gte" in cond || "lte" in cond) return (!cond.gte || row[key] >= cond.gte) && (!cond.lte || row[key] <= cond.lte);
      return true;
    }
    return row[key] === cond;
  });
}

const workspaceRef = (workspaceId) => {
  const w = workspaces.find((x) => x.id === workspaceId);
  return { name: w.name, color: w.color };
};

const fakePrisma = {
  workspace: {
    findMany: async ({ where, include }) => {
      const userId = where.members.some.userId;
      return workspaces
        .filter((w) => memberships.some((m) => m.workspaceId === w.id && m.userId === userId))
        .map((w) => ({
          ...w,
          _count: { members: memberships.filter((m) => m.workspaceId === w.id).length },
          members: memberships.filter((m) => m.workspaceId === w.id && m.userId === include.members.where.userId),
        }));
    },
  },
  taskStatus: { findMany: async () => [{ id: "DONE" }] },
  event: {
    findMany: async ({ where, include }) => {
      const userId = include.attendees.where.userId;
      return events
        .filter((e) => matches(e, where))
        .map((e) => ({
          ...e,
          workspace: workspaceRef(e.workspaceId),
          attendees: e.attendeeIds.filter((id) => id === userId).map((id) => ({ id })),
        }));
    },
  },
  task: {
    findMany: async ({ where }) =>
      tasks.filter((t) => matches(t, where)).map((t) => ({ ...t, workspace: workspaceRef(t.workspaceId) })),
  },
  message: { findMany: async () => [] },
  notification: { findMany: async () => [], count: async () => 0 },
  asset: { findMany: async () => [] },
  folder: { findMany: async () => [] },
};

async function clashesFor(userId) {
  const res = { json(body) { this.body = body; return this; } };
  await getDashboard({ userId }, res);
  return res.body.conflicts.map((c) => c.items.map((i) => i.id).sort().join("+")).sort();
}

describe("dashboard clashes by role", () => {
  setPrismaClient(fakePrisma);
  after(() => clearPrismaClient(fakePrisma));

  it("shows an admin every clash across the workspaces they run", async () => {
    assert.deepEqual(await clashesFor("admin"), [
      "e-a+e-b",
      "t-member-a+t-member-b",
      "t-mixed-b+t-other-a",
      "t-other-a+t-other-b",
    ]);
  });

  it("shows a member only clashes between their own tasks and meetings", async () => {
    assert.deepEqual(await clashesFor("member"), ["t-member-a+t-member-b"]);
  });

  it("scopes a mixed-role user per workspace", async () => {
    // Every Alpha task counts (they run it), but in Beta only their own does:
    // their task clashes with Alpha's, while Beta's other deadline that day
    // and the Beta meeting they don't attend stay out of view.
    assert.deepEqual(await clashesFor("mixed"), ["t-mixed-b+t-other-a"]);
  });

  it("still lists every workspace meeting on the calendar for a member", async () => {
    const res = { json(body) { this.body = body; return this; } };
    await getDashboard({ userId: "member" }, res);
    assert.deepEqual(res.body.upcomingEvents.map((e) => e.id), ["e-a", "e-b"]);
  });
});

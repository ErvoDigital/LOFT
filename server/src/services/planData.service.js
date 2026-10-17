import { prisma } from "../db/prisma.js";
import { buildPlan, PLAN_HORIZON_DAYS } from "./plan.service.js";
import { calculatePriorityScore } from "./priority.service.js";
import { detectConflicts } from "./conflict.service.js";
import { planPreferencesSchema, readPreferences } from "./preferences.js";
import { buildCapacityCalendar } from "../utils/time.js";

// My Plan — every open task assigned to the caller across all their
// workspaces, ranked by the Smart Priority Engine (tier + deadline decay +
// pin/snooze overrides) and laid out into a day-by-day schedule based on
// each task's estimated effort and due date. Also runs the same
// cross-workspace conflict detection the dashboard uses, scoped down to just
// this user's own tasks and the events they're attending — this is meant to
// be the one place prioritization and SyncTayo's "chain reaction" conflicts show
// up together, instead of split across two pages.
export async function getPlanData({ userId, workspaceId, dailyCapacityHours, timeZone, now = new Date() }, db = prisma) {
  const user = db.user?.findUnique ? await db.user.findUnique({ where: { id: userId }, select: { planPreferences: true } }) : null;
  const preferences = readPreferences(user?.planPreferences, planPreferencesSchema);
  dailyCapacityHours ??= preferences.dailyCapacityHours;
  timeZone ||= preferences.timeZone;
  const scope = { workspace: { members: { some: { userId } } }, ...(workspaceId ? { workspaceId } : {}) };
  const horizon = new Date(now.getTime() + PLAN_HORIZON_DAYS * 24 * 60 * 60 * 1000);

  const doneStatuses = await db.taskStatus.findMany({ where: { isDone: true, workspace: { members: { some: { userId } } } }, select: { id: true } });
  const doneStatusIds = doneStatuses.map((s) => s.id);

  const [tasks, events] = await Promise.all([
    db.task.findMany({
      where: { ...scope, assigneeId: userId, status: { notIn: [...doneStatusIds, "COMPLETED"] } },
      include: { workspace: { select: { name: true, color: true } }, dependencies: { include: { dependsOn: { select: { id: true, title: true, status: true } } } } },
      orderBy: [{ dueDate: "asc" }],
    }),
    db.event.findMany({
      where: { ...scope, attendees: { some: { userId, response: { not: "DECLINED" } } }, endTime: { gte: now }, startTime: { lte: horizon } },
      include: { workspace: { select: { name: true, color: true } } },
      orderBy: [{ startTime: "asc" }],
    }),
  ]);

  // My Plan's day rows let you re-column a task's status inline without
  // opening it, but each workspace has its own custom status set — so the
  // options for that dropdown have to travel with the plan response, keyed
  // by workspace, same as workspaceName/workspaceColor already do per task.
  const workspaceIds = [...new Set(tasks.map((t) => t.workspaceId))];
  const workspaceStatuses = workspaceIds.length
    ? await db.taskStatus.findMany({
        where: { workspaceId: { in: workspaceIds } },
        orderBy: [{ order: "asc" }],
      })
    : [];
  const statusesByWorkspace = {};
  for (const s of workspaceStatuses) {
    (statusesByWorkspace[s.workspaceId] ??= []).push({ id: s.id, label: s.label, color: s.color, isDone: s.isDone });
  }

  const planTasks = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    workspaceId: t.workspaceId,
    workspaceName: t.workspace.name,
    workspaceColor: t.workspace.color,
    tier: t.tier,
    status: t.status,
    estimatedMinutes: t.estimatedMinutes,
    isPinned: t.isPinned,
    isSnoozed: t.isSnoozed,
    dueDate: t.dueDate,
  }));
  const planEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    workspaceId: e.workspaceId,
    workspaceName: e.workspace.name,
    workspaceColor: e.workspace.color,
    location: e.location,
    startTime: e.startTime,
    endTime: e.endTime,
  }));

  const capacityByDate = buildCapacityCalendar({ ...preferences, now, timeZone, dailyCapacityHours, events: planEvents });
  const plan = buildPlan({ tasks: planTasks, now, dailyCapacityHours, timeZone, capacityByDate });
  const conflicts = detectConflicts({ events: planEvents, tasks: planTasks, timeZone, dailyCapacityHours });

  return {
    generatedAt: now.toISOString(),
    preferences: { ...preferences, dailyCapacityHours, timeZone },
    preferencesSaved: Boolean(user?.planPreferences),
    capacityByDate,
    timeZone,
    tasks: tasks.map((t) => ({
      id: t.id,
      workspaceId: t.workspaceId,
      workspaceName: t.workspace.name,
      workspaceColor: t.workspace.color,
      title: t.title,
      description: t.description,
      tier: t.tier,
      estimatedMinutes: t.estimatedMinutes,
      isPinned: t.isPinned,
      isSnoozed: t.isSnoozed,
      status: t.status,
      dueDate: t.dueDate,
      score: calculatePriorityScore(t, now),
      blockedBy: (t.dependencies || []).filter((edge) => ![...doneStatusIds, "COMPLETED"].includes(edge.dependsOn.status)).map((edge) => ({ id: edge.dependsOn.id, title: edge.dependsOn.title })),
    })),
    conflicts,
    statusesByWorkspace,
    events: planEvents,
    ...plan,
  };
}

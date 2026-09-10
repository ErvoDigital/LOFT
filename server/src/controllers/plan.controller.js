import { prisma } from "../db/prisma.js";
import { buildPlan, PLAN_HORIZON_DAYS } from "../services/plan.service.js";
import { calculatePriorityScore } from "../services/priority.service.js";
import { detectConflicts } from "../services/conflict.service.js";

// My Plan — every open task assigned to the caller across all their
// workspaces, ranked by the Smart Priority Engine (tier + deadline decay +
// pin/snooze overrides) and laid out into a day-by-day schedule based on
// each task's estimated effort and due date. Also runs the same
// cross-workspace conflict detection the dashboard uses, scoped down to just
// this user's own tasks and the events they're attending — this is meant to
// be the one place prioritization and LOFT's "chain reaction" conflicts show
// up together, instead of split across two pages.
export async function getPlan(req, res) {
  const userId = req.userId;
  const dailyCapacityHours = Math.max(1, Math.min(16, Number(req.query.capacity) || 6));
  const now = new Date();
  const horizon = new Date(now.getTime() + PLAN_HORIZON_DAYS * 24 * 60 * 60 * 1000);

  const doneStatuses = await prisma.taskStatus.findMany({ where: { isDone: true }, select: { id: true } });
  const doneStatusIds = doneStatuses.map((s) => s.id);

  const [tasks, events] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: userId, status: { notIn: doneStatusIds } },
      include: { workspace: { select: { name: true, color: true } } },
      orderBy: [{ dueDate: "asc" }],
    }),
    prisma.event.findMany({
      where: { attendees: { some: { userId } }, startTime: { gte: now, lte: horizon } },
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
    ? await prisma.taskStatus.findMany({
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
    startTime: e.startTime,
    endTime: e.endTime,
  }));

  const plan = buildPlan({ tasks: planTasks, now, dailyCapacityHours });
  const conflicts = detectConflicts({ events: planEvents, tasks: planTasks });

  res.json({
    tasks: tasks.map((t) => ({
      id: t.id,
      workspaceId: t.workspaceId,
      workspaceName: t.workspace.name,
      workspaceColor: t.workspace.color,
      title: t.title,
      tier: t.tier,
      estimatedMinutes: t.estimatedMinutes,
      isPinned: t.isPinned,
      isSnoozed: t.isSnoozed,
      status: t.status,
      dueDate: t.dueDate,
      score: calculatePriorityScore(t, now),
    })),
    conflicts,
    statusesByWorkspace,
    ...plan,
  });
}

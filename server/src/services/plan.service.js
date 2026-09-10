// Builds a day-by-day plan for a user's open tasks across every workspace —
// My Plan's core differentiator: turning a flat cross-workspace task list
// into "what should I actually work on today" by ranking tasks with the
// Smart Priority Engine (services/priority.service.js) and then greedily
// filling each day's capacity in that order.
//
// Ranking (by score, descending) decides which task claims capacity first;
// each task's own due date still caps how far ahead it's allowed to search
// for room. A task that can't fit entirely before its due date at that pace
// is reported as "at risk" instead of silently dropped — its remaining
// effort still gets placed on the soonest days after the deadline so it
// isn't lost from the plan.

import { calculatePriorityScore } from "./priority.service.js";

export const PLAN_HORIZON_DAYS = 30;
const DEFAULT_DAILY_CAPACITY_HOURS = 6;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayIndex(date, today) {
  return Math.round((startOfDay(date) - today) / 86400000);
}

// tasks: [{ id, title, workspaceId, workspaceName, workspaceColor, tier,
// status, estimatedMinutes, dueDate, isPinned, isSnoozed }] — callers are
// expected to have already excluded tasks in a "done" status.
export function buildPlan({ tasks, now = new Date(), dailyCapacityHours = DEFAULT_DAILY_CAPACITY_HOURS, horizonDays = PLAN_HORIZON_DAYS }) {
  const today = startOfDay(now);

  const dated = [];
  const someday = [];
  for (const task of tasks) {
    const effortHours = (task.estimatedMinutes ?? 30) / 60;
    const score = calculatePriorityScore(task, now);
    if (task.dueDate) {
      const due = startOfDay(task.dueDate);
      const overdue = due < today;
      dated.push({ task, effortHours, score, dueIndex: overdue ? 0 : dayIndex(due, today), overdue });
    } else {
      someday.push({ task, effortHours, score });
    }
  }

  dated.sort((a, b) => b.score - a.score);
  someday.sort((a, b) => b.score - a.score);

  const capacity = new Map(); // dayIndex -> hours remaining
  const dayItems = new Map(); // dayIndex -> [{ task, hours, overflow }]
  const remainingCapacity = (i) => (capacity.has(i) ? capacity.get(i) : dailyCapacityHours);
  const allocate = (i, hours, extra) => {
    capacity.set(i, remainingCapacity(i) - hours);
    if (!dayItems.has(i)) dayItems.set(i, []);
    dayItems.get(i).push({ hours, ...extra });
  };

  const atRisk = [];

  for (const entry of dated) {
    let remaining = entry.effortHours;
    let i = 0;
    while (remaining > 0 && i <= entry.dueIndex) {
      const avail = remainingCapacity(i);
      if (avail > 0) {
        const chunk = Math.min(avail, remaining);
        allocate(i, chunk, { task: entry.task, score: entry.score });
        remaining -= chunk;
      }
      i++;
    }
    if (remaining > 0) {
      atRisk.push({ task: entry.task, shortfallHours: remaining });
      let j = entry.dueIndex + 1;
      while (remaining > 0 && j <= horizonDays) {
        const avail = remainingCapacity(j);
        if (avail > 0) {
          const chunk = Math.min(avail, remaining);
          allocate(j, chunk, { task: entry.task, score: entry.score, overflow: true });
          remaining -= chunk;
        }
        j++;
      }
    }
  }

  const unscheduled = [];
  for (const entry of someday) {
    let remaining = entry.effortHours;
    let i = 0;
    while (remaining > 0 && i <= horizonDays) {
      const avail = remainingCapacity(i);
      if (avail > 0) {
        const chunk = Math.min(avail, remaining);
        allocate(i, chunk, { task: entry.task, score: entry.score, someday: true });
        remaining -= chunk;
      }
      i++;
    }
    if (remaining > 0) unscheduled.push(entry.task);
  }

  const lastDay = dayItems.size === 0 ? -1 : Math.max(...dayItems.keys());
  const days = [];
  for (let i = 0; i <= lastDay; i++) {
    const items = dayItems.get(i);
    if (!items || items.length === 0) continue;
    days.push({
      date: new Date(today.getTime() + i * 86400000).toISOString(),
      isToday: i === 0,
      capacityHours: dailyCapacityHours,
      plannedHours: Math.round(items.reduce((sum, it) => sum + it.hours, 0) * 100) / 100,
      items: items
        .sort((a, b) => b.score - a.score)
        .map((it) => ({
          taskId: it.task.id,
          title: it.task.title,
          workspaceId: it.task.workspaceId,
          workspaceName: it.task.workspaceName,
          workspaceColor: it.task.workspaceColor,
          tier: it.task.tier,
          status: it.task.status,
          estimatedMinutes: it.task.estimatedMinutes,
          isPinned: !!it.task.isPinned,
          isSnoozed: !!it.task.isSnoozed,
          dueDate: it.task.dueDate,
          hours: Math.round(it.hours * 100) / 100,
          overflow: !!it.overflow,
          someday: !!it.someday,
        })),
    });
  }

  return {
    dailyCapacityHours,
    days,
    atRisk: atRisk.map(({ task, shortfallHours }) => ({
      taskId: task.id,
      title: task.title,
      workspaceId: task.workspaceId,
      workspaceName: task.workspaceName,
      tier: task.tier,
      estimatedMinutes: task.estimatedMinutes,
      dueDate: task.dueDate,
      shortfallHours: Math.round(shortfallHours * 100) / 100,
    })),
    unscheduled: unscheduled.map((task) => ({
      taskId: task.id,
      title: task.title,
      workspaceId: task.workspaceId,
      workspaceName: task.workspaceName,
      tier: task.tier,
      estimatedMinutes: task.estimatedMinutes,
      isPinned: !!task.isPinned,
      isSnoozed: !!task.isSnoozed,
    })),
  };
}

import { prisma } from "../db/prisma.js";
import { notify } from "./notification.service.js";
import { notificationPreferencesSchema, readPreferences } from "./preferences.js";
import { emitToUser } from "../sockets/io.js";
import { quietNow } from "./preferences.js";

const CHECK_INTERVAL_MS = 60 * 1000;

async function remindUpcomingEvents(now, db, send) {
  const windowEnd = new Date(now.getTime() + 10080 * 60000);
  const events = await db.event.findMany({
    where: { startTime: { gte: new Date(now.getTime() - 5 * 60000), lte: windowEnd } },
    include: {
      workspace: { select: { name: true } },
      attendees: { include: { user: { select: { notificationPreferences: true } } } },
    },
  });

  for (const event of events) {
    for (const a of event.attendees) {
      if (a.response === "DECLINED") continue;
      const preferences = readPreferences(a.user?.notificationPreferences, notificationPreferencesSchema);
      if (!preferences.eventReminderMinutes || new Date(event.startTime) - now > preferences.eventReminderMinutes * 60000) continue;
      await send(a.userId, {
          type: "EVENT_REMINDER",
          title: `Starting soon: ${event.title}`,
          body: `${event.workspace.name} · ${new Date(event.startTime).toLocaleString("en", { timeZone: preferences.timeZone, dateStyle: "medium", timeStyle: "short" })}`,
          link: `/workspaces/${event.workspaceId}/calendar?event=${event.id}`,
          dedupeKey: `event:${event.id}:${new Date(event.startTime).toISOString()}:${a.userId}`,
        }, { db, now, preferences });
    }
  }
}

async function remindUpcomingTaskDeadlines(now, db, send) {
  const windowEnd = new Date(now.getTime() + 10080 * 60000);
  const doneStatuses = await db.taskStatus.findMany({ where: { isDone: true }, select: { id: true } });
  const tasks = await db.task.findMany({
    where: {
      dueDate: { gte: now, lte: windowEnd },
      status: { notIn: [...doneStatuses.map((s) => s.id), "COMPLETED"] },
      assigneeId: { not: null },
    },
    include: { workspace: { select: { name: true, members: { select: { userId: true } } } }, assignee: { select: { notificationPreferences: true } } },
  });

  for (const task of tasks) {
    if (!task.workspace.members.some((member) => member.userId === task.assigneeId)) continue;
    const preferences = readPreferences(task.assignee?.notificationPreferences, notificationPreferencesSchema);
    if (!preferences.taskReminderMinutes || new Date(task.dueDate) - now > preferences.taskReminderMinutes * 60000) continue;
    await send(task.assigneeId, {
      type: "TASK_DUE_SOON",
      title: `Due soon: ${task.title}`,
      body: `${task.workspace.name} · due ${new Date(task.dueDate).toLocaleString("en", { timeZone: preferences.timeZone, dateStyle: "medium", timeStyle: "short" })}`,
      link: `/workspaces/${task.workspaceId}/tasks?task=${task.id}`,
      dedupeKey: `task:${task.id}:${new Date(task.dueDate).toISOString()}:${task.assigneeId}`,
    }, { db, now, preferences });
  }
}

export async function runReminderJob({ now = new Date(), db = prisma, send = notify } = {}) {
  let delivered = 0;
  const countedSend = async (...args) => { const result = await send(...args); if (result) delivered++; return result; };
  await remindUpcomingEvents(now, db, countedSend);
  await remindUpcomingTaskDeadlines(now, db, countedSend);
  const snoozed = await db.notification.findMany({ where: { snoozedUntil: { lte: now }, isRead: false }, take: 500, include: { user: { select: { notificationPreferences: true } } } });
  for (const { user, ...notification } of snoozed) {
    const claimed = await db.notification.updateMany({ where: { id: notification.id, snoozedUntil: notification.snoozedUntil }, data: { snoozedUntil: null } });
    if (claimed.count) emitToUser(notification.userId, "notification:resumed", { ...notification, snoozedUntil: null, silent: quietNow(readPreferences(user.notificationPreferences, notificationPreferencesSchema), now) });
  }
  return { delivered, checkedAt: now.toISOString() };
}

let lastOpportunisticRunAt = 0;
let opportunisticRunning = null;

export async function maybeRunReminderJob({ now = new Date(), db = prisma, send = notify } = {}) {
  if (!db?.event?.findMany || !db?.task?.findMany || !db?.notification?.findMany) return null;
  if (opportunisticRunning) return opportunisticRunning;
  if (now.getTime() - lastOpportunisticRunAt < CHECK_INTERVAL_MS) return null;
  lastOpportunisticRunAt = now.getTime();
  opportunisticRunning = runReminderJob({ now, db, send })
    .catch((err) => {
      console.error("Reminder check failed:", err);
      return null;
    })
    .finally(() => {
      opportunisticRunning = null;
    });
  return opportunisticRunning;
}

export function startReminderJob() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runReminderJob();
    } catch (err) {
      console.error("Reminder job failed:", err);
    } finally { running = false; }
  };

  tick();
  return setInterval(tick, CHECK_INTERVAL_MS);
}

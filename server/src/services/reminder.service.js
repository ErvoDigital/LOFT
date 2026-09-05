import { prisma } from "../db/prisma.js";
import { notify } from "./notification.service.js";

const REMINDER_WINDOW_MS = 15 * 60 * 1000; // notify when something is within 15 minutes
const CHECK_INTERVAL_MS = 60 * 1000;

async function remindUpcomingEvents(now) {
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);
  const events = await prisma.event.findMany({
    where: { startTime: { gte: now, lte: windowEnd }, remindedAt: null },
    include: {
      workspace: { select: { name: true } },
      attendees: { select: { userId: true } },
    },
  });

  for (const event of events) {
    await Promise.all(
      event.attendees.map((a) =>
        notify(a.userId, {
          type: "EVENT_REMINDER",
          title: `Starting soon: ${event.title}`,
          body: `${event.workspace.name} · ${new Date(event.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          link: `/workspaces/${event.workspaceId}/calendar`,
        })
      )
    );
    await prisma.event.update({ where: { id: event.id }, data: { remindedAt: now } });
  }
}

async function remindUpcomingTaskDeadlines(now) {
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // due within 24h
  const doneStatuses = await prisma.taskStatus.findMany({ where: { isDone: true }, select: { id: true } });
  const tasks = await prisma.task.findMany({
    where: {
      dueDate: { gte: now, lte: windowEnd },
      remindedAt: null,
      status: { notIn: doneStatuses.map((s) => s.id) },
      assigneeId: { not: null },
    },
    include: { workspace: { select: { name: true } } },
  });

  for (const task of tasks) {
    await notify(task.assigneeId, {
      type: "TASK_DUE_SOON",
      title: `Due soon: ${task.title}`,
      body: `${task.workspace.name} · due ${new Date(task.dueDate).toLocaleString()}`,
      link: `/workspaces/${task.workspaceId}/tasks`,
    });
    await prisma.task.update({ where: { id: task.id }, data: { remindedAt: now } });
  }
}

export function startReminderJob() {
  const tick = async () => {
    const now = new Date();
    try {
      await remindUpcomingEvents(now);
      await remindUpcomingTaskDeadlines(now);
    } catch (err) {
      console.error("Reminder job failed:", err);
    }
  };

  tick();
  return setInterval(tick, CHECK_INTERVAL_MS);
}

import { prisma } from "../db/prisma.js";
import { detectConflicts } from "../services/conflict.service.js";

// The single aggregated view across every workspace the user belongs to —
// upcoming events, pending tasks, recent activity, notifications, and any
// cross-workspace conflicts between them. This endpoint is the reason LOFT
// exists: nothing here required the user to check multiple tools.
export async function getDashboard(req, res) {
  const userId = req.userId;
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const workspaces = await prisma.workspace.findMany({
    where: { members: { some: { userId } } },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "asc" },
  });
  const workspaceIds = workspaces.map((w) => w.id);
  const doneStatuses = await prisma.taskStatus.findMany({ where: { isDone: true }, select: { id: true } });
  const doneStatusIds = doneStatuses.map((s) => s.id);

  const [upcomingEvents, pendingTasks, allOpenTasksWithDates, recentMessages, notifications, unreadCount] =
    await Promise.all([
      prisma.event.findMany({
        where: { workspaceId: { in: workspaceIds }, startTime: { gte: now, lte: horizon } },
        include: { workspace: { select: { name: true, color: true } } },
        orderBy: { startTime: "asc" },
        take: 20,
      }),
      prisma.task.findMany({
        where: { assigneeId: userId, status: { notIn: doneStatusIds } },
        include: { workspace: { select: { name: true, color: true } } },
        orderBy: [{ dueDate: "asc" }],
        take: 50,
      }),
      prisma.task.findMany({
        where: { workspaceId: { in: workspaceIds }, status: { notIn: doneStatusIds }, dueDate: { not: null } },
        include: { workspace: { select: { name: true, color: true } } },
      }),
      prisma.message.findMany({
        where: { conversation: { OR: [{ workspaceId: { in: workspaceIds } }, { participants: { some: { userId } } }] } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          sender: { select: { id: true, name: true, avatarColor: true } },
          conversation: { include: { workspace: { select: { name: true } } } },
        },
      }),
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

  const eventsForConflicts = upcomingEvents.map((e) => ({
    id: e.id,
    title: e.title,
    workspaceId: e.workspaceId,
    workspaceName: e.workspace.name,
    startTime: e.startTime,
    endTime: e.endTime,
  }));
  const tasksForConflicts = allOpenTasksWithDates.map((t) => ({
    id: t.id,
    title: t.title,
    workspaceId: t.workspaceId,
    workspaceName: t.workspace.name,
    dueDate: t.dueDate,
    priority: t.priority,
    status: t.status,
  }));
  const conflicts = detectConflicts({ events: eventsForConflicts, tasks: tasksForConflicts });

  res.json({
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type,
      color: w.color,
      memberCount: w._count.members,
    })),
    upcomingEvents: eventsForConflicts,
    pendingTasks: pendingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      workspaceId: t.workspaceId,
      workspaceName: t.workspace.name,
      workspaceColor: t.workspace.color,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
    })),
    recentActivity: recentMessages.map((m) => ({
      id: m.id,
      type: "message",
      sender: m.sender,
      content: m.content,
      workspaceName: m.conversation.workspace?.name || "Direct message",
      createdAt: m.createdAt,
    })),
    notifications,
    unreadCount,
    conflicts,
  });
}

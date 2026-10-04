import { prisma } from "../db/prisma.js";
import { detectConflicts } from "../services/conflict.service.js";
import { isFolderVisible } from "../services/folderAccess.js";

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
    include: { _count: { select: { members: true } }, members: { where: { userId } } },
    orderBy: { createdAt: "asc" },
  });
  const workspaceIds = workspaces.map((w) => w.id);
  const membershipByWorkspaceId = new Map(workspaces.map((w) => [w.id, w.members[0]]));
  // Clashes are scoped by role: in a workspace the caller admins they see
  // every clash its tasks and meetings are part of; anywhere they're only a
  // member, just the ones involving their own tasks and the meetings they attend.
  const adminWorkspaceIds = workspaces.filter((w) => w.members[0].role === "ADMIN").map((w) => w.id);
  const doneStatuses = await prisma.taskStatus.findMany({ where: { isDone: true }, select: { id: true } });
  const doneStatusIds = doneStatuses.map((s) => s.id);

  const [
    upcomingEvents,
    pendingTasks,
    clashableTasks,
    recentMessages,
    notifications,
    unreadCount,
    recentAssets,
    visibleFolders,
  ] = await Promise.all([
      prisma.event.findMany({
        where: { workspaceId: { in: workspaceIds }, startTime: { gte: now, lte: horizon } },
        include: {
          workspace: { select: { name: true, color: true } },
          attendees: { where: { userId }, select: { id: true } },
        },
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
        where: {
          workspaceId: { in: workspaceIds },
          status: { notIn: doneStatusIds },
          dueDate: { not: null },
          OR: [{ workspaceId: { in: adminWorkspaceIds } }, { assigneeId: userId }],
        },
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
      // Over-fetched, then narrowed by folder visibility below — the caller's
      // access differs per workspace, so this can't be filtered in the query.
      prisma.asset.findMany({
        where: { workspaceId: { in: workspaceIds }, taskId: null },
        orderBy: { updatedAt: "desc" },
        take: 40,
        include: {
          workspace: { select: { name: true, color: true } },
          uploadedBy: { select: { id: true, name: true, avatarColor: true } },
          versions: { orderBy: { version: "desc" }, take: 1 },
        },
      }),
      prisma.folder.findMany({ where: { workspaceId: { in: workspaceIds } }, include: { members: true } }),
    ]);

  const folderById = new Map(visibleFolders.map((f) => [f.id, f]));
  const recentFiles = recentAssets
    .filter(
      (a) => !a.folderId || isFolderVisible(userId, membershipByWorkspaceId.get(a.workspaceId), folderById.get(a.folderId), folderById)
    )
    .slice(0, 10)
    .map((a) => ({
      id: a.id,
      name: a.name,
      workspaceId: a.workspaceId,
      workspaceName: a.workspace.name,
      workspaceColor: a.workspace.color,
      folderId: a.folderId,
      updatedAt: a.updatedAt,
      uploadedBy: a.uploadedBy,
      latestVersion: a.versions[0] || null,
    }));

  const toEventSummary = (e) => ({
    id: e.id,
    title: e.title,
    workspaceId: e.workspaceId,
    workspaceName: e.workspace.name,
    startTime: e.startTime,
    endTime: e.endTime,
  });
  const eventsForConflicts = upcomingEvents
    .filter((e) => adminWorkspaceIds.includes(e.workspaceId) || e.attendees.length > 0)
    .map(toEventSummary);
  const tasksForConflicts = clashableTasks.map((t) => ({
    id: t.id,
    title: t.title,
    workspaceId: t.workspaceId,
    workspaceName: t.workspace.name,
    dueDate: t.dueDate,
    tier: t.tier,
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
    upcomingEvents: upcomingEvents.map(toEventSummary),
    pendingTasks: pendingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      workspaceId: t.workspaceId,
      workspaceName: t.workspace.name,
      workspaceColor: t.workspace.color,
      tier: t.tier,
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
    recentFiles,
    notifications,
    unreadCount,
    conflicts,
  });
}

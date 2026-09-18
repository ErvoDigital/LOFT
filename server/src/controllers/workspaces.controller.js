import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { notify } from "../services/notification.service.js";
import { generateInviteCode } from "../utils/inviteCode.js";
import { ensureWorkspaceStatuses } from "./taskStatuses.controller.js";
import { isFolderVisible } from "../services/folderAccess.js";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(400).optional(),
  type: z.enum(["school", "work", "org", "church", "other"]).default("other"),
  color: z.string().min(3).max(20).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(400).optional(),
  type: z.enum(["school", "work", "org", "church", "other"]).optional(),
  color: z.string().min(3).max(20).optional(),
});

const joinSchema = z.object({ inviteCode: z.string().min(4).max(20) });

const roleSchema = z.object({ role: z.enum(["ADMIN", "MANAGER", "MEMBER"]) });

function workspaceSummary(ws) {
  return {
    id: ws.id,
    name: ws.name,
    description: ws.description,
    type: ws.type,
    color: ws.color,
    inviteCode: ws.inviteCode,
    ownerId: ws.ownerId,
    createdAt: ws.createdAt,
    memberCount: ws._count?.members,
    myRole: ws.members?.[0]?.role,
  };
}

export async function listMyWorkspaces(req, res) {
  const workspaces = await prisma.workspace.findMany({
    where: { members: { some: { userId: req.userId } } },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId: req.userId } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json({ workspaces: workspaces.map(workspaceSummary) });
}

export async function createWorkspace(req, res) {
  const data = createSchema.parse(req.body);

  const workspace = await prisma.workspace.create({
    data: {
      ...data,
      color: data.color || "#17BC95",
      ownerId: req.userId,
      inviteCode: generateInviteCode(),
      members: { create: { userId: req.userId, role: "ADMIN" } },
      conversations: {
        create: {
          isGroup: true,
          isDefault: true,
          title: "General",
          createdById: req.userId,
          participants: { create: { userId: req.userId } },
        },
      },
    },
    include: { _count: { select: { members: true } }, members: { where: { userId: req.userId } } },
  });

  await ensureWorkspaceStatuses(workspace.id);

  res.status(201).json({ workspace: workspaceSummary(workspace) });
}

export async function getWorkspace(req, res) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: req.params.workspaceId },
    include: {
      _count: { select: { members: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!workspace) throw new ApiError(404, "Workspace not found");

  res.json({
    workspace: {
      ...workspaceSummary(workspace),
      myRole: req.membership.role,
      members: workspace.members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
    },
  });
}

// The workspace-scoped counterpart to dashboard.controller.js's cross-workspace
// view: the same kinds of signal (tasks, schedule, activity, files) narrowed to
// a single workspace, so entering one lands on its own overview.
export async function getWorkspaceDashboard(req, res) {
  const workspaceId = req.params.workspaceId;
  const role = req.membership.role;
  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const doneStatuses = await prisma.taskStatus.findMany({
    where: { workspaceId, isDone: true },
    select: { id: true },
  });
  const doneStatusIds = doneStatuses.map((s) => s.id);

  const [allTasks, upcomingEvents, recentMessages, assets, folders] = await Promise.all([
    prisma.task.findMany({
      where: { workspaceId },
      include: { assignee: { select: { id: true, name: true, avatarColor: true } } },
      orderBy: [{ dueDate: "asc" }],
    }),
    prisma.event.findMany({
      where: { workspaceId, startTime: { gte: now, lte: horizon } },
      orderBy: { startTime: "asc" },
      take: 20,
    }),
    prisma.message.findMany({
      where: { conversation: { workspaceId } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { sender: { select: { id: true, name: true, avatarColor: true } } },
    }),
    prisma.asset.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: {
        uploadedBy: { select: { id: true, name: true, avatarColor: true } },
        versions: { orderBy: { version: "desc" }, take: 1 },
      },
    }),
    prisma.folder.findMany({ where: { workspaceId }, include: { members: true } }),
  ]);

  const folderById = new Map(folders.map((f) => [f.id, f]));
  const openTasks = allTasks.filter((t) => !doneStatusIds.includes(t.status));
  // Padded on both sides: the schedule strip buckets tasks into the viewer's
  // own local days, and this server's idea of "today" can sit a timezone away.
  const weekWindowStart = new Date(now.getTime() - 36 * 60 * 60 * 1000);
  const weekWindowEnd = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

  res.json({
    tasksSummary: {
      total: allTasks.length,
      done: allTasks.length - openTasks.length,
      pending: openTasks.length,
      dueToday: openTasks.filter((t) => t.dueDate && t.dueDate >= now && t.dueDate <= endOfToday).length,
      overdue: openTasks.filter((t) => t.dueDate && t.dueDate < now).length,
    },
    tasksDueSoon: openTasks
      .filter((t) => t.dueDate)
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        tier: t.tier,
        status: t.status,
        dueDate: t.dueDate,
        estimatedMinutes: t.estimatedMinutes,
        isPinned: t.isPinned,
        assignee: t.assignee,
      })),
    weekTasks: openTasks
      .filter((t) => t.dueDate && t.dueDate >= weekWindowStart && t.dueDate <= weekWindowEnd)
      .map((t) => ({
        id: t.id,
        title: t.title,
        tier: t.tier,
        dueDate: t.dueDate,
        assignee: t.assignee,
      })),
    upcomingEvents: upcomingEvents.map((e) => ({
      id: e.id,
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      location: e.location,
    })),
    recentActivity: recentMessages.map((m) => ({
      id: m.id,
      type: "message",
      sender: m.sender,
      content: m.content,
      createdAt: m.createdAt,
    })),
    // Same folder-visibility rule the storage page enforces — a restricted
    // folder's filenames must not leak into an overview panel.
    recentFiles: assets
      .filter((a) => !a.folderId || isFolderVisible(req.userId, role, folderById.get(a.folderId)))
      .slice(0, 6)
      .map((a) => ({
        id: a.id,
        name: a.name,
        folderId: a.folderId,
        updatedAt: a.updatedAt,
        uploadedBy: a.uploadedBy,
        latestVersion: a.versions[0] || null,
      })),
  });
}

export async function updateWorkspace(req, res) {
  const data = updateSchema.parse(req.body);
  const workspace = await prisma.workspace.update({
    where: { id: req.params.workspaceId },
    data,
  });
  res.json({ workspace: workspaceSummary({ ...workspace, _count: { members: 0 } }) });
}

export async function joinWorkspace(req, res) {
  const { inviteCode } = joinSchema.parse(req.body);

  const workspace = await prisma.workspace.findUnique({ where: { inviteCode: inviteCode.toUpperCase() } });
  if (!workspace) throw new ApiError(404, "Invalid invite code");

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: req.userId } },
  });
  if (existing) throw new ApiError(409, "You are already a member of this workspace");

  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: req.userId, role: "MEMBER" },
  });

  const defaultChannel = await prisma.conversation.findFirst({
    where: { workspaceId: workspace.id, isDefault: true },
  });
  if (defaultChannel) {
    await prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: defaultChannel.id, userId: req.userId } },
      update: {},
      create: { conversationId: defaultChannel.id, userId: req.userId },
    });
  }

  const admins = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace.id, role: { in: ["ADMIN", "MANAGER"] } },
  });
  const joiner = await prisma.user.findUnique({ where: { id: req.userId } });
  await Promise.all(
    admins.map((m) =>
      notify(m.userId, {
        type: "WORKSPACE_INVITE",
        title: `${joiner.name} joined ${workspace.name}`,
        link: `/workspaces/${workspace.id}`,
      })
    )
  );

  res.status(201).json({ workspace: workspaceSummary(workspace) });
}

export async function leaveWorkspace(req, res) {
  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });
  if (workspace.ownerId === req.userId) {
    throw new ApiError(400, "The owner cannot leave the workspace. Transfer ownership or delete it instead.");
  }

  await prisma.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.userId } },
  });
  await prisma.conversationParticipant.deleteMany({
    where: { userId: req.userId, conversation: { workspaceId: req.params.workspaceId } },
  });
  res.json({ message: "Left workspace" });
}

export async function updateMemberRole(req, res) {
  const { role } = roleSchema.parse(req.body);
  const member = await prisma.workspaceMember.update({
    where: { id: req.params.memberId },
    data: { role },
  });
  res.json({ member });
}

export async function removeMember(req, res) {
  const member = await prisma.workspaceMember.delete({ where: { id: req.params.memberId } });
  await prisma.conversationParticipant.deleteMany({
    where: { userId: member.userId, conversation: { workspaceId: member.workspaceId } },
  });
  res.json({ message: "Member removed" });
}

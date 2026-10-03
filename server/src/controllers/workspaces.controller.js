import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { notify } from "../services/notification.service.js";
import { generateInviteCode } from "../utils/inviteCode.js";
import { ensureWorkspaceStatuses } from "./taskStatuses.controller.js";
import { isFolderVisible } from "../services/folderAccess.js";
import { PERMISSIONS, can, parsePermissions, permissionsOf, serializePermissions } from "../services/permissions.js";
import { imageDataUrlSchema } from "../utils/imageDataUrl.js";

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
  logoUrl: imageDataUrlSchema,
});

const joinSchema = z.object({ inviteCode: z.string().min(4).max(20) });

// Any subset may be sent; a field left out is left alone. permissions only
// matter while the member is a MEMBER, so becoming an ADMIN clears them.
const accessSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  title: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .optional()
    .transform((t) => (t ? t : t === undefined ? undefined : null)),
  permissions: z.array(z.enum(PERMISSIONS)).optional(),
});

// The invite code lets anyone holding it walk in, so only admins are sent it.
// Everyone else invites by asking an admin, who can email an invite instead.
export function workspaceSummary(ws, role = ws.members?.[0]?.role) {
  return {
    id: ws.id,
    name: ws.name,
    description: ws.description,
    type: ws.type,
    color: ws.color,
    logoUrl: ws.logoUrl,
    inviteCode: role === "ADMIN" ? ws.inviteCode : undefined,
    ownerId: ws.ownerId,
    createdAt: ws.createdAt,
    memberCount: ws._count?.members,
    myRole: role,
    myPermissions: ws.members?.[0] ? permissionsOf(ws.members[0]) : undefined,
  };
}

function serializeMember(m) {
  return {
    id: m.id,
    role: m.role,
    title: m.title,
    permissions: parsePermissions(m.permissions),
    joinedAt: m.joinedAt,
    user: m.user,
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
      color: data.color || "#134A3C",
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
      ...workspaceSummary(workspace, req.membership.role),
      myRole: req.membership.role,
      myPermissions: permissionsOf(req.membership),
      members: workspace.members.map(serializeMember),
    },
  });
}

// The workspace-scoped counterpart to dashboard.controller.js's cross-workspace
// view: the same kinds of signal (tasks, schedule, activity, files) narrowed to
// a single workspace, so entering one lands on its own overview.
export async function getWorkspaceDashboard(req, res) {
  const workspaceId = req.params.workspaceId;
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
      where: { workspaceId, taskId: null },
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
      .filter((a) => !a.folderId || isFolderVisible(req.userId, req.membership, folderById.get(a.folderId), folderById))
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
  res.json({ workspace: workspaceSummary({ ...workspace, _count: { members: 0 } }, req.membership.role) });
}

// Swaps the invite code for a fresh one, and the old code stops working at
// once. It's for a code that has got around further than meant (before codes
// were admin-only, every member could see it). People already in stay in, and
// emailed invites don't use the code, so they keep working.
export async function resetInviteCode(req, res) {
  const workspace = await prisma.workspace.update({
    where: { id: req.params.workspaceId },
    data: { inviteCode: generateInviteCode() },
  });
  res.json({ inviteCode: workspace.inviteCode });
}

// Adds someone to a workspace as a MEMBER, the one way in for both an invite
// code and an emailed invite. They land in the General channel, any invite
// still waiting on their address is cleared (it has done its job), and
// whoever looks after the member list hears about a new face in it.
export async function admitMember(workspace, userId) {
  const joiner = await prisma.user.findUnique({ where: { id: userId } });

  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId, role: "MEMBER" },
  });

  const defaultChannel = await prisma.conversation.findFirst({
    where: { workspaceId: workspace.id, isDefault: true },
  });
  if (defaultChannel) {
    await prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: defaultChannel.id, userId } },
      update: {},
      create: { conversationId: defaultChannel.id, userId },
    });
  }

  await prisma.workspaceInvite.deleteMany({
    where: { workspaceId: workspace.id, email: joiner.email.toLowerCase() },
  });

  const members = await prisma.workspaceMember.findMany({ where: { workspaceId: workspace.id } });
  await Promise.all(
    members
      .filter((m) => m.userId !== userId && can(m, "members.manage"))
      .map((m) =>
        notify(m.userId, {
          type: "WORKSPACE_INVITE",
          title: `${joiner.name} joined ${workspace.name}`,
          link: `/workspaces/${workspace.id}`,
        })
      )
  );
}

export async function joinWorkspace(req, res) {
  const { inviteCode } = joinSchema.parse(req.body);

  const workspace = await prisma.workspace.findUnique({ where: { inviteCode: inviteCode.toUpperCase() } });
  if (!workspace) throw new ApiError(404, "Invalid invite code");

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: req.userId } },
  });
  if (existing) throw new ApiError(409, "You are already a member of this workspace");

  await admitMember(workspace, req.userId);

  res.status(201).json({ workspace: workspaceSummary(workspace, "MEMBER") });
}

export async function leaveWorkspace(req, res) {
  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });
  if (workspace.ownerId === req.userId) {
    throw new ApiError(400, "The owner cannot leave the workspace. Transfer ownership or delete it instead.");
  }

  await prisma.$transaction([
    prisma.folderMember.deleteMany({
      where: { userId: req.userId, folder: { workspaceId: req.params.workspaceId } },
    }),
    prisma.conversationParticipant.deleteMany({
      where: { userId: req.userId, conversation: { workspaceId: req.params.workspaceId } },
    }),
    prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.userId } },
    }),
  ]);
  res.json({ message: "Left workspace" });
}

// Loads a member of the workspace in the URL. A memberId is a global row id,
// so without this check an admin of one workspace could reach into another.
async function findWorkspaceMember(req) {
  const member = await prisma.workspaceMember.findUnique({
    where: { id: req.params.memberId },
    include: { workspace: { select: { ownerId: true } } },
  });
  if (!member || member.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Member not found");
  return member;
}

// One admin-only endpoint for everything on the Access dialog: role, title and
// abilities. The owner always stays an admin, and nobody changes their own
// role here, so a workspace can't be left without an admin by accident.
export async function updateMemberAccess(req, res) {
  const data = accessSchema.parse(req.body);
  const member = await findWorkspaceMember(req);

  if (data.role && data.role !== member.role) {
    if (member.userId === member.workspace.ownerId) {
      throw new ApiError(400, "The workspace owner is always an admin");
    }
    if (member.userId === req.userId) throw new ApiError(400, "You can't change your own access level");
  }

  const role = data.role ?? member.role;
  const update = { role };
  if (data.title !== undefined) update.title = data.title;
  if (role === "ADMIN") update.permissions = "";
  else if (data.permissions) update.permissions = serializePermissions(data.permissions);

  const updated = await prisma.workspaceMember.update({
    where: { id: member.id },
    data: update,
    include: { user: { select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true } } },
  });
  res.json({ member: serializeMember(updated) });
}

export async function removeMember(req, res) {
  const target = await findWorkspaceMember(req);
  if (target.userId === target.workspace.ownerId) throw new ApiError(400, "The workspace owner can't be removed");
  if (target.userId === req.userId) throw new ApiError(400, "Use Leave workspace to remove yourself");
  // members.manage is handed out to non-admins, and it mustn't become a way
  // to push an admin out.
  if (target.role === "ADMIN" && req.membership.role !== "ADMIN") {
    throw new ApiError(403, "Only admins can remove an admin");
  }

  const [, , member] = await prisma.$transaction([
    prisma.folderMember.deleteMany({
      where: { userId: target.userId, folder: { workspaceId: target.workspaceId } },
    }),
    prisma.conversationParticipant.deleteMany({
      where: { userId: target.userId, conversation: { workspaceId: target.workspaceId } },
    }),
    prisma.workspaceMember.delete({ where: { id: target.id } }),
  ]);
  res.json({ message: "Member removed" });
}

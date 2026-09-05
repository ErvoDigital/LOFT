import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { notify } from "../services/notification.service.js";
import { generateInviteCode } from "../utils/inviteCode.js";
import { ensureWorkspaceStatuses } from "./taskStatuses.controller.js";

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
      color: data.color || "#5B5BD6",
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

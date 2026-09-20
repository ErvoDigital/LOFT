import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";

const MAX_QUERY_LENGTH = 100;
const CATEGORY_LIMIT = 10;

export async function globalSearch(req, res) {
  const rawQ = req.query.q;

  // Handle missing or non-string query parameter
  if (typeof rawQ !== "string") {
    return res.json({
      query: "",
      results: { tasks: [], messages: [], assets: [], users: [] },
    });
  }

  const queryStr = rawQ.trim();

  // Handle empty or whitespace-only query
  if (!queryStr) {
    return res.json({
      query: "",
      results: { tasks: [], messages: [], assets: [], users: [] },
    });
  }

  // Prevent expensive/malformed queries
  if (queryStr.length > MAX_QUERY_LENGTH) {
    throw new ApiError(400, `Search query is too long (maximum ${MAX_QUERY_LENGTH} characters)`);
  }

  // 1. Determine authorized workspaces and roles for the authenticated caller
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: req.userId },
    select: { workspaceId: true, role: true },
  });

  if (memberships.length === 0) {
    return res.json({
      query: queryStr,
      results: { tasks: [], messages: [], assets: [], users: [] },
    });
  }

  const authorizedWorkspaceIds = memberships.map((m) => m.workspaceId);
  const adminWorkspaceIds = memberships.filter((m) => m.role === "ADMIN").map((m) => m.workspaceId);
  const memberWorkspaceIds = memberships.filter((m) => m.role !== "ADMIN").map((m) => m.workspaceId);

  // Asset visibility conditions directly enforced in Prisma (semantically matching isFolderVisible):
  // - In ADMIN workspaces: any asset in that workspace is discoverable.
  // - In member workspaces: asset must have no folder, be in a WORKSPACE folder,
  //   be in a folder created by the caller, or caller is listed in FolderMember.
  const assetPermissionBranches = [];
  if (adminWorkspaceIds.length > 0) {
    assetPermissionBranches.push({ workspaceId: { in: adminWorkspaceIds } });
  }
  if (memberWorkspaceIds.length > 0) {
    assetPermissionBranches.push({
      workspaceId: { in: memberWorkspaceIds },
      OR: [
        { folderId: null },
        { folder: { visibility: "WORKSPACE" } },
        { folder: { createdById: req.userId } },
        { folder: { members: { some: { userId: req.userId } } } },
      ],
    });
  }

  // 2. Parallel scoped database queries across Tasks, Messages, Assets, and Users
  const [tasks, messages, assets, users] = await Promise.all([
    // TASKS: Only in authorized workspaces, matching title or description
    prisma.task.findMany({
      where: {
        workspaceId: { in: authorizedWorkspaceIds },
        OR: [
          { title: { contains: queryStr, mode: "insensitive" } },
          { description: { contains: queryStr, mode: "insensitive" } },
        ],
      },
      take: CATEGORY_LIMIT,
      orderBy: { updatedAt: "desc" },
      include: {
        workspace: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, avatarColor: true } },
      },
    }),

    // MESSAGES: Only in authorized channels/conversations where the user is a participant
    prisma.message.findMany({
      where: {
        conversation: {
          workspaceId: { in: authorizedWorkspaceIds },
          participants: { some: { userId: req.userId } },
        },
        content: { contains: queryStr, mode: "insensitive" },
      },
      take: CATEGORY_LIMIT,
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, avatarColor: true } },
        conversation: { select: { id: true, title: true, isDefault: true, workspaceId: true } },
      },
    }),

    // ASSETS: Authorization directly enforced via Prisma query; no candidate buffer
    prisma.asset.findMany({
      where: {
        name: { contains: queryStr, mode: "insensitive" },
        OR: assetPermissionBranches,
      },
      take: CATEGORY_LIMIT,
      orderBy: { updatedAt: "desc" },
      include: {
        workspace: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true } },
        versions: { orderBy: { version: "desc" }, take: 1 },
      },
    }),

    // USERS: Only users discoverable in workspaces shared with the caller
    prisma.user.findMany({
      where: {
        memberships: {
          some: { workspaceId: { in: authorizedWorkspaceIds } },
        },
        OR: [
          { name: { contains: queryStr, mode: "insensitive" } },
          { email: { contains: queryStr, mode: "insensitive" } },
        ],
      },
      take: CATEGORY_LIMIT,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        avatarColor: true,
        avatarUrl: true,
      },
    }),
  ]);

  // 3. Return serialized response
  res.json({
    query: queryStr,
    results: {
      tasks: tasks.map((t) => ({
        id: t.id,
        workspaceId: t.workspaceId,
        workspaceName: t.workspace.name,
        title: t.title,
        description: t.description,
        status: t.status,
        tier: t.tier,
        dueDate: t.dueDate,
        assignee: t.assignee
          ? { id: t.assignee.id, name: t.assignee.name, avatarColor: t.assignee.avatarColor }
          : null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      messages: messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        workspaceId: m.conversation.workspaceId,
        conversationTitle: m.conversation.title || (m.conversation.isDefault ? "General" : "Chat"),
        content: m.content,
        sender: {
          id: m.sender.id,
          name: m.sender.name,
          avatarColor: m.sender.avatarColor,
        },
        createdAt: m.createdAt,
      })),
      assets: assets.map((a) => ({
        id: a.id,
        workspaceId: a.workspaceId,
        workspaceName: a.workspace.name,
        folderId: a.folderId,
        folderName: a.folder?.name || null,
        name: a.name,
        latestVersion: a.versions[0]
          ? {
              version: a.versions[0].version,
              originalName: a.versions[0].originalName,
              mimeType: a.versions[0].mimeType,
              size: a.versions[0].size,
            }
          : null,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatarColor: u.avatarColor,
        avatarUrl: u.avatarUrl,
      })),
    },
  });
}

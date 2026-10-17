import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { isFolderVisible } from "../services/folderAccess.js";
import { can } from "../services/permissions.js";

const MAX_QUERY_LENGTH = 100;
const CATEGORY_LIMIT = 10;

export async function searchRecords(req, res, db = prisma) {
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
  let memberships = await db.workspaceMember.findMany({
    where: { userId: req.userId },
    select: { workspaceId: true, role: true, permissions: true },
  });

  if (req.query.workspaceId) {
    if (typeof req.query.workspaceId !== "string" || !memberships.some((m) => m.workspaceId === req.query.workspaceId)) throw new ApiError(403, "Workspace is not accessible");
    memberships = memberships.filter((m) => m.workspaceId === req.query.workspaceId);
  }

  const authorizedWorkspaceIds = memberships.map((m) => m.workspaceId);
  const folders = await db.folder.findMany({
    where: { workspaceId: { in: authorizedWorkspaceIds } },
    include: { members: true },
  });
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const assetPermissionBranches = memberships.map((membership) => ({
    workspaceId: membership.workspaceId,
    OR: [
      { folderId: null },
      {
        folderId: {
          in: folders
            .filter(
              (folder) =>
                folder.workspaceId === membership.workspaceId &&
                isFolderVisible(req.userId, membership, folder, folderById)
            )
            .map((folder) => folder.id),
        },
      },
    ],
  }));

  // 2. Parallel scoped database queries across Tasks, Messages, Assets, and Users
  const [tasks, messages, assets, users, documents, events] = await Promise.all([
    // TASKS: Only in authorized workspaces, matching title or description
    db.task.findMany({
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
    db.message.findMany({
      where: {
        conversation: {
          OR: [{ workspaceId: { in: authorizedWorkspaceIds } }, ...(!req.query.workspaceId ? [{ workspaceId: null }] : [])],
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
    db.asset.findMany({
      where: {
        name: { contains: queryStr, mode: "insensitive" },
        taskId: null,
        deletedAt: null,
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
    db.user.findMany({
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
    db.document.findMany({
      where: { title: { contains: queryStr, mode: "insensitive" }, OR: memberships.map((member) => ({ workspaceId: member.workspaceId, ...(can(member, "documents.viewAll") ? {} : { OR: [{ visibility: "WORKSPACE" }, { createdById: req.userId }, { assignees: { some: { userId: req.userId } } }] }) })) },
      take: CATEGORY_LIMIT, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, workspaceId: true, workspace: { select: { name: true } }, updatedAt: true },
    }),
    db.event.findMany({
      where: { workspaceId: { in: authorizedWorkspaceIds }, OR: [{ title: { contains: queryStr, mode: "insensitive" } }, { description: { contains: queryStr, mode: "insensitive" } }] },
      take: CATEGORY_LIMIT, orderBy: { startTime: "desc" }, select: { id: true, title: true, workspaceId: true, workspace: { select: { name: true } }, startTime: true, endTime: true },
    }),
  ]);

  // 3. Return serialized response
  res.json({
    query: queryStr,
    results: {
      documents: documents.map(({ workspace, ...doc }) => ({ ...doc, workspaceName: workspace.name })),
      events: events.map(({ workspace, ...event }) => ({ ...event, workspaceName: workspace.name })),
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

export async function globalSearch(req, res) { return searchRecords(req, res); }

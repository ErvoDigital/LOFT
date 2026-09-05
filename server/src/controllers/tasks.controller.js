import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { notify } from "../services/notification.service.js";
import { emitToWorkspace } from "../sockets/io.js";
import { assertValidStatus, ensureWorkspaceStatuses } from "./taskStatuses.controller.js";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const taskSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  status: z.string().min(1).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  order: z.number().optional(),
});

function serialize(task) {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    workspaceName: task.workspace?.name,
    workspaceColor: task.workspace?.color,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate,
    order: task.order,
    createdById: task.createdById,
    assignee: task.assignee,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function listWorkspaceTasks(req, res) {
  const tasks = await prisma.task.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { assignee: { select: { id: true, name: true, avatarColor: true } } },
    orderBy: [{ status: "asc" }, { order: "asc" }],
  });
  res.json({ tasks: tasks.map(serialize) });
}

// Every task assigned to the caller across all their workspaces.
export async function listMyTasks(req, res) {
  const tasks = await prisma.task.findMany({
    where: { assigneeId: req.userId },
    include: {
      workspace: { select: { name: true, color: true } },
      assignee: { select: { id: true, name: true, avatarColor: true } },
    },
    orderBy: [{ dueDate: "asc" }],
  });
  res.json({ tasks: tasks.map(serialize) });
}

export async function createTask(req, res) {
  const data = taskSchema.parse(req.body);
  const workspaceId = req.params.workspaceId;

  if (data.status) {
    await assertValidStatus(workspaceId, data.status);
  } else {
    const [first] = await ensureWorkspaceStatuses(workspaceId);
    data.status = first.id;
  }

  if (data.assigneeId) {
    const isMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: data.assigneeId } },
    });
    if (!isMember) throw new ApiError(400, "Assignee is not a member of this workspace");
  }

  if (data.order === undefined) {
    const last = await prisma.task.findFirst({
      where: { workspaceId, status: data.status },
      orderBy: { order: "desc" },
    });
    data.order = (last?.order ?? 0) + 1;
  }

  const task = await prisma.task.create({
    data: { ...data, workspaceId, createdById: req.userId },
    include: {
      workspace: { select: { name: true, color: true } },
      assignee: { select: { id: true, name: true, avatarColor: true } },
    },
  });

  emitToWorkspace(workspaceId, "task:created", serialize(task));
  if (task.assigneeId && task.assigneeId !== req.userId) {
    await notify(task.assigneeId, {
      type: "TASK_ASSIGNED",
      title: `New task assigned: ${task.title}`,
      body: task.workspace.name,
      link: `/workspaces/${workspaceId}/tasks`,
    });
  }

  res.status(201).json({ task: serialize(task) });
}

export async function updateTask(req, res) {
  const data = taskSchema.partial().parse(req.body);
  const existing = await prisma.task.findUnique({ where: { id: req.params.taskId } });
  if (!existing || existing.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Task not found");

  if (data.status) {
    await assertValidStatus(req.params.workspaceId, data.status);
  }

  if (data.assigneeId) {
    const isMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: data.assigneeId } },
    });
    if (!isMember) throw new ApiError(400, "Assignee is not a member of this workspace");
  }

  const task = await prisma.task.update({
    where: { id: req.params.taskId },
    data,
    include: {
      workspace: { select: { name: true, color: true } },
      assignee: { select: { id: true, name: true, avatarColor: true } },
    },
  });

  emitToWorkspace(req.params.workspaceId, "task:updated", serialize(task));
  if (
    data.assigneeId &&
    data.assigneeId !== existing.assigneeId &&
    data.assigneeId !== req.userId
  ) {
    await notify(data.assigneeId, {
      type: "TASK_ASSIGNED",
      title: `New task assigned: ${task.title}`,
      body: task.workspace.name,
      link: `/workspaces/${req.params.workspaceId}/tasks`,
    });
  }

  res.json({ task: serialize(task) });
}

export async function deleteTask(req, res) {
  const existing = await prisma.task.findUnique({ where: { id: req.params.taskId } });
  if (!existing || existing.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Task not found");

  await prisma.task.delete({ where: { id: req.params.taskId } });
  emitToWorkspace(req.params.workspaceId, "task:deleted", { id: req.params.taskId });
  res.json({ message: "Task deleted" });
}

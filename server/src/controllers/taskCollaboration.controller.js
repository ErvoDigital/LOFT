import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { assertAcyclicDependency, serializable } from "../services/taskCollaboration.js";
import { emitToWorkspace } from "../sockets/io.js";

async function taskFor(req, db = prisma) {
  const task = await db.task.findUnique({ where: { id: req.params.taskId } });
  if (!task || task.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Task not found");
  return task;
}
export async function getDetails(req, res) {
  const task = await taskFor(req);
  const [comments, changes, subtasks, dependencies, availableTasks, statuses] = await Promise.all([
    prisma.taskComment.findMany({ where: { taskId: task.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.taskChange.findMany({ where: { taskId: task.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.task.findMany({ where: { parentTaskId: task.id, workspaceId: task.workspaceId }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, status: true } }),
    prisma.taskDependency.findMany({ where: { taskId: task.id }, include: { dependsOn: { select: { id: true, title: true, status: true } } } }),
    prisma.task.findMany({ where: { workspaceId: task.workspaceId, id: { not: task.id } }, select: { id: true, title: true, status: true }, orderBy: { title: "asc" }, take: 500 }),
    prisma.taskStatus.findMany({ where: { workspaceId: task.workspaceId }, select: { id: true, label: true, isDone: true } }),
  ]);
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set([...comments, ...changes].map((item) => item.userId))] } }, select: { id: true, name: true } });
  const author = (row) => users.find((user) => user.id === row.userId)?.name || "Former member";
  const done = new Set(["COMPLETED", ...statuses.filter((status) => status.isDone).map((status) => status.id)]);
  res.json({ task, comments: comments.reverse().map((row) => ({ ...row, author: author(row) })), changes: changes.map((row) => ({ ...row, author: author(row), changes: JSON.parse(row.changes) })), subtasks, dependencies: dependencies.map((edge) => ({ ...edge.dependsOn, completed: done.has(edge.dependsOn.status) })), availableTasks, statuses });
}
export async function addComment(req, res) {
  const { content } = z.object({ content: z.string().trim().min(1).max(4000) }).strict().parse(req.body);
  const task = await taskFor(req);
  const comment = await prisma.taskComment.create({ data: { taskId: task.id, userId: req.userId, content } });
  emitToWorkspace(task.workspaceId, "task:collaboration", { id: task.id, workspaceId: task.workspaceId });
  res.status(201).json({ comment });
}
export async function setDependency(req, res) {
  const { dependsOnId } = z.object({ dependsOnId: z.string().min(1).max(100) }).strict().parse(req.body);
  await serializable(prisma, async (tx) => {
    const task = await taskFor(req, tx);
    const blocker = await tx.task.findUnique({ where: { id: dependsOnId } });
    if (!blocker || blocker.workspaceId !== task.workspaceId) throw new ApiError(400, "Dependency must belong to this workspace");
    const edges = await tx.taskDependency.findMany({ where: { task: { workspaceId: task.workspaceId } } });
    assertAcyclicDependency(edges, task.id, dependsOnId);
    await tx.taskDependency.upsert({ where: { taskId_dependsOnId: { taskId: task.id, dependsOnId } }, create: { taskId: task.id, dependsOnId }, update: {} });
    await tx.taskChange.create({ data: { taskId: task.id, userId: req.userId, changes: JSON.stringify({ dependency: { before: null, after: blocker.title } }) } });
  });
  emitToWorkspace(req.params.workspaceId, "task:collaboration", { id: req.params.taskId, workspaceId: req.params.workspaceId });
  res.json({ message: "Dependency added" });
}
export async function removeDependency(req, res) {
  await taskFor(req);
  await prisma.taskDependency.deleteMany({ where: { taskId: req.params.taskId, dependsOnId: req.params.dependsOnId } });
  emitToWorkspace(req.params.workspaceId, "task:collaboration", { id: req.params.taskId, workspaceId: req.params.workspaceId });
  res.json({ message: "Dependency removed" });
}

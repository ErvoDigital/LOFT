import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { emitToWorkspace } from "../sockets/io.js";

// The three columns every workspace starts with. Nothing downstream treats
// these as special beyond `isDone` — admins can rename, recolor, reorder, or
// delete any of them (as long as at least one status remains).
const SEED_STATUSES = [
  { label: "To do", color: "#8C8474", isDone: false, legacyKey: "TODO" },
  { label: "In progress", color: "#C17538", isDone: false, legacyKey: "IN_PROGRESS" },
  { label: "Completed", color: "#3F6B52", isDone: true, legacyKey: "COMPLETED" },
];

const createSchema = z.object({
  label: z.string().min(1).max(40),
  color: z.string().min(3).max(20).optional(),
});

const updateSchema = z.object({
  label: z.string().min(1).max(40).optional(),
  color: z.string().min(3).max(20).optional(),
  order: z.number().optional(),
  isDone: z.boolean().optional(),
});

function serialize(status) {
  return {
    id: status.id,
    label: status.label,
    color: status.color,
    order: status.order,
    isDone: status.isDone,
  };
}

// Lazily seeds a workspace's three starter statuses on first use, and
// backfills any legacy tasks that still carry the old hardcoded status
// strings (TODO / IN_PROGRESS / COMPLETED) onto the new rows. Idempotent —
// once a workspace has any TaskStatus rows, this is a no-op.
export async function ensureWorkspaceStatuses(workspaceId) {
  const existing = await prisma.taskStatus.findMany({
    where: { workspaceId },
    orderBy: { order: "asc" },
  });
  if (existing.length > 0) return existing;

  const created = [];
  for (let i = 0; i < SEED_STATUSES.length; i++) {
    const seed = SEED_STATUSES[i];
    const status = await prisma.taskStatus.create({
      data: { workspaceId, label: seed.label, color: seed.color, isDone: seed.isDone, order: i },
    });
    await prisma.task.updateMany({
      where: { workspaceId, status: seed.legacyKey },
      data: { status: status.id },
    });
    created.push(status);
  }
  return created;
}

// Any task status value must be a real TaskStatus row belonging to the workspace.
export async function assertValidStatus(workspaceId, status) {
  const row = await prisma.taskStatus.findUnique({ where: { id: status } });
  if (!row || row.workspaceId !== workspaceId) {
    throw new ApiError(400, "Invalid task status");
  }
}

export async function listTaskStatuses(req, res) {
  const statuses = await ensureWorkspaceStatuses(req.params.workspaceId);
  res.json({ statuses: statuses.map(serialize) });
}

export async function createTaskStatus(req, res) {
  const data = createSchema.parse(req.body);
  const workspaceId = req.params.workspaceId;

  await ensureWorkspaceStatuses(workspaceId);
  const last = await prisma.taskStatus.findFirst({
    where: { workspaceId },
    orderBy: { order: "desc" },
  });

  const status = await prisma.taskStatus.create({
    data: {
      workspaceId,
      label: data.label,
      color: data.color || "#8a8578",
      order: (last?.order ?? 0) + 1,
    },
  });

  emitToWorkspace(workspaceId, "taskStatus:created", serialize(status));
  res.status(201).json({ status: serialize(status) });
}

export async function updateTaskStatus(req, res) {
  const data = updateSchema.parse(req.body);
  const existing = await prisma.taskStatus.findUnique({ where: { id: req.params.statusId } });
  if (!existing || existing.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Status not found");

  if (data.isDone === true) {
    await prisma.taskStatus.updateMany({
      where: { workspaceId: req.params.workspaceId, isDone: true },
      data: { isDone: false },
    });
  }

  const status = await prisma.taskStatus.update({ where: { id: existing.id }, data });
  emitToWorkspace(req.params.workspaceId, "taskStatus:updated", serialize(status));
  res.json({ status: serialize(status) });
}

export async function deleteTaskStatus(req, res) {
  const existing = await prisma.taskStatus.findUnique({ where: { id: req.params.statusId } });
  if (!existing || existing.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Status not found");

  const total = await prisma.taskStatus.count({ where: { workspaceId: req.params.workspaceId } });
  if (total <= 1) throw new ApiError(400, "A workspace needs at least one status.");

  const inUse = await prisma.task.count({
    where: { workspaceId: req.params.workspaceId, status: existing.id },
  });
  if (inUse > 0) {
    throw new ApiError(400, `Move the ${inUse} task${inUse === 1 ? "" : "s"} in "${existing.label}" to another status before deleting it.`);
  }

  await prisma.taskStatus.delete({ where: { id: existing.id } });
  emitToWorkspace(req.params.workspaceId, "taskStatus:deleted", { id: existing.id });
  res.json({ message: "Status deleted" });
}

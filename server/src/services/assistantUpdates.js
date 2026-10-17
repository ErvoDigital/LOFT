import { z } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { taskSchema } from "../controllers/tasks.controller.js";
import { eventSchema } from "../controllers/events.controller.js";
import { can } from "./permissions.js";
import { changedTaskFields, serializable } from "./taskCollaboration.js";
import { emitToWorkspace } from "../sockets/io.js";

const schemas = {
  task_update: taskSchema.pick({ title: true, description: true, tier: true, status: true, dueDate: true, estimatedMinutes: true, assigneeId: true }).partial().strict(),
  event_update: eventSchema.omit({ recurrence: true }).partial().strict(),
};
async function checkUpdate(kind, data, userId, db) {
  const member = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: data.workspaceId, userId } }, include: { workspace: { select: { name: true } } } });
  if (!member) throw new ApiError(403, "Workspace access was removed");
  const task = kind === "task_update";
  const record = await db[task ? "task" : "event"].findUnique({ where: { id: data.recordId }, ...(task ? {} : { include: { attendees: true } }) });
  if (!record || record.workspaceId !== data.workspaceId) throw new ApiError(404, "The item is no longer available");
  const changes = schemas[kind].parse(data.changes);
  if (!Object.keys(changes).length) throw new ApiError(400, "Specify at least one change");
  if (!task && !can(member, "events.manage")) throw new ApiError(403, "You cannot edit this event");
  if (task && changes.status && changes.status !== record.status) {
    if (record.assigneeId !== userId && !can(member, "tasks.status")) throw new ApiError(403, "You cannot change this task's status");
    const status = await db.taskStatus.findUnique({ where: { id: changes.status } });
    if (!status || status.workspaceId !== data.workspaceId) throw new ApiError(400, "Status does not belong to this workspace");
  }
  if (!task && new Date(changes.endTime ?? record.endTime) <= new Date(changes.startTime ?? record.startTime)) throw new ApiError(400, "End time must be after start time");
  const people = task ? changes.assigneeId ? [changes.assigneeId] : [] : [...new Set(changes.attendeeIds || [])];
  for (const person of people) {
    const membership = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: data.workspaceId, userId: person } } });
    if (!membership) throw new ApiError(400, "A selected person is no longer a workspace member");
  }
  return { member, record, changes };
}
export async function prepareAssistantUpdate(kind, raw, userId, db) {
  const input = z.object({ workspaceId: z.string().uuid(), recordId: z.string().uuid(), changes: z.record(z.unknown()) }).strict().parse(raw);
  const { member, record, changes } = await checkUpdate(kind, input, userId, db);
  const before = Object.fromEntries(Object.keys(changes).map((field) => [field, field === "attendeeIds" ? record.attendees.map((person) => person.userId) : record[field] ?? null]));
  return { data: { ...input, changes, before, expectedUpdatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : null }, preview: { workspaceName: member.workspace?.name, title: record.title } };
}
export async function confirmAssistantUpdate(action, userId, db) {
  const data = action.data;
  const result = await serializable(db, async (tx) => {
    const checked = await checkUpdate(action.kind, data, userId, tx);
    const previous = await tx.assistantMutation?.findUnique({ where: { id: action.actionId } });
    if (previous) return { kind: action.kind, id: previous.recordId, workspaceId: previous.workspaceId, alreadyCreated: true };
    const { record, changes } = checked;
    if ((record.updatedAt ? new Date(record.updatedAt).toISOString() : null) !== data.expectedUpdatedAt) throw new ApiError(409, "This item changed after the preview. Ask Lofty for a fresh preview.");
    const task = action.kind === "task_update", { attendeeIds, ...patch } = changes;
    if (task && patch.dueDate !== undefined) patch.remindedAt = null;
    if (!task && patch.startTime !== undefined) patch.remindedAt = null;
    const saved = await tx[task ? "task" : "event"].update({ where: { id: record.id }, data: { ...patch, ...(!task && attendeeIds ? { attendees: { deleteMany: { userId: { notIn: attendeeIds } }, create: attendeeIds.filter((id) => !record.attendees.some((a) => a.userId === id)).map((userId) => ({ userId })) } } : {}) } });
    if (task) await tx.taskChange?.create({ data: { taskId: record.id, userId, changes: JSON.stringify(changedTaskFields(record, saved)) } });
    await tx.assistantMutation?.create({ data: { id: action.actionId, userId, workspaceId: data.workspaceId, recordId: record.id, kind: action.kind } });
    return { kind: action.kind, id: record.id, workspaceId: data.workspaceId };
  });
  emitToWorkspace(result.workspaceId, action.kind === "task_update" ? "task:updated" : "event:updated", { id: result.id, workspaceId: result.workspaceId });
  return result;
}

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { PRIORITY_LABELS } from "../utils/priorities.js";

export const DETAIL_FIELDS = ["workspaceId", "title", "description", "dueDate", "tier", "assigneeId", "startTime", "endTime", "attendeeIds", "location", "answer"];
const schema = z.object({
  kind: z.enum(["task", "event", "clarification"]),
  prompt: z.string().trim().min(1).max(300),
  workspaceId: z.string().uuid().optional(),
  fields: z.array(z.enum(DETAIL_FIELDS)).min(1).max(8),
}).strict();
const definitions = {
  workspaceId: { label: "Workspace", type: "select" },
  title: { label: "Title", type: "text", maxLength: 160 },
  description: { label: "Description", type: "textarea", maxLength: 2000 },
  dueDate: { label: "Due date and time", type: "datetime-local" },
  tier: { label: "Priority", type: "select", options: Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })) },
  assigneeId: { label: "Assignee", type: "select" },
  startTime: { label: "Start date and time", type: "datetime-local" },
  endTime: { label: "End date and time", type: "datetime-local" },
  attendeeIds: { label: "Attendees", type: "multiselect" },
  location: { label: "Location", type: "text", maxLength: 200 },
  answer: { label: "Your answer", type: "textarea", maxLength: 2000 },
};
const allowed = {
  task: new Set(["workspaceId", "title", "description", "dueDate", "tier", "assigneeId"]),
  event: new Set(["workspaceId", "title", "description", "location", "startTime", "endTime", "attendeeIds"]),
  clarification: new Set(["answer"]),
};

// Choices come from authorized database reads, never model-generated IDs.
// This only collects information. Existing signed proposals still gate saves.
export async function buildDetailRequest(raw, { userId, workspaceId: activeWorkspaceId, db, assertMembership }) {
  const data = schema.parse(raw);
  if (data.fields.some((name) => !allowed[data.kind].has(name))) throw new ApiError(400, "Unsupported detail fields for this request.");
  if (activeWorkspaceId && data.workspaceId && data.workspaceId !== activeWorkspaceId) throw new ApiError(403, "Switch workspace context to use that workspace.");
  const workspaceId = activeWorkspaceId || data.workspaceId;
  if (workspaceId) await assertMembership(userId, workspaceId, db);
  const names = [...new Set(data.fields)];
  let people;
  if (names.some((name) => ["assigneeId", "attendeeIds"].includes(name))) {
    if (!workspaceId || names.includes("workspaceId")) throw new ApiError(400, "Ask for the workspace first, then request its members in a separate form.");
    const members = await db.workspaceMember.findMany({ where: { workspaceId }, select: { user: { select: { id: true, name: true } } }, take: 100 });
    people = members.map(({ user }) => ({ value: user.id, label: user.name }));
  }
  let workspaces;
  if (names.includes("workspaceId")) {
    const rows = await db.workspace.findMany({ where: { members: { some: { userId } }, ...(activeWorkspaceId ? { id: activeWorkspaceId } : {}) }, select: { id: true, name: true }, take: 100 });
    workspaces = rows.map(({ id, name }) => ({ value: id, label: name }));
  }
  return {
    id: randomUUID(), kind: data.kind, prompt: data.prompt,
    fields: names.map((name) => ({ name, required: true, ...definitions[name],
      ...(name === "workspaceId" ? { options: workspaces } : {}),
      ...(name === "assigneeId" ? { options: [{ value: "unassigned", label: "Unassigned" }, ...people] } : {}),
      ...(name === "attendeeIds" ? { options: people } : {}),
    })),
  };
}

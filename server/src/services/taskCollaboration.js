import { ApiError } from "../utils/ApiError.js";

export async function assertParent(db, workspaceId, taskId, parentTaskId) {
  let id = parentTaskId;
  const visited = new Set([taskId]);
  while (id) {
    if (visited.has(id)) throw new ApiError(400, "Subtasks cannot form a cycle");
    if (visited.size > 100) throw new ApiError(400, "Subtask nesting is too deep");
    visited.add(id);
    const parent = await db.task.findUnique({ where: { id }, select: { id: true, workspaceId: true, parentTaskId: true } });
    if (!parent || parent.workspaceId !== workspaceId) throw new ApiError(400, "Parent task must belong to this workspace");
    id = parent.parentTaskId;
  }
}
export function assertAcyclicDependency(edges, taskId, dependsOnId) {
  const next = new Map();
  for (const edge of edges) { if (!next.has(edge.taskId)) next.set(edge.taskId, []); next.get(edge.taskId).push(edge.dependsOnId); }
  const queue = [dependsOnId], visited = new Set();
  while (queue.length) {
    const id = queue.pop();
    if (id === taskId) throw new ApiError(400, "This dependency would create a cycle");
    if (visited.has(id)) continue;
    visited.add(id); queue.push(...(next.get(id) || []));
  }
}
export function changedTaskFields(previous, next) {
  return Object.fromEntries(["title", "description", "tier", "status", "dueDate", "estimatedMinutes", "assigneeId", "parentTaskId", "isPinned", "isSnoozed"].filter((key) => JSON.stringify(previous[key] ?? null) !== JSON.stringify(next[key] ?? null)).map((key) => [key, { before: previous[key] ?? null, after: next[key] ?? null }]));
}
export async function serializable(db, action) {
  if (!db.$transaction) return action(db);
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await db.$transaction(action, { isolationLevel: "Serializable" }); }
    catch (error) { if (error.code !== "P2034" || attempt === 2) throw error; }
  }
}

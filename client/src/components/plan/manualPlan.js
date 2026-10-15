import { dayKey } from "../dashboard/fortnight.js";

export const manualPlanKey = (userId) => `loft:my-plan:${userId}`;
export const emptyManualPlan = () => ({ order: [], dates: {} });
export function validPlanDay(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString().slice(0, 10) === value;
}
export function readManualPlan(userId, storage = localStorage) {
  try {
    const data = JSON.parse(storage.getItem(manualPlanKey(userId)));
    return { order: [...new Set((Array.isArray(data?.order) ? data.order : []).filter((id) => typeof id === "string"))].slice(0, 1000),
      dates: Object.fromEntries(Object.entries(data?.dates || {}).filter(([, value]) => validPlanDay(value)).slice(0, 1000)),
    };
  } catch { return emptyManualPlan(); }
}
export const planDate = (item) => item.plannedDate ? `${item.plannedDate}T12:00:00` : item.dueDate;
export function applyManualPlan(items, preferences, aiOrder = []) {
  const ranks = new Map(preferences.order.map((id, index) => [id, index]));
  const aiRanks = new Map(aiOrder.map((id, index) => [id, index]));
  return items.map((item) => {
    const plannedDate = preferences.dates[item.taskId];
    const plannedAfterDeadline = Boolean(plannedDate && item.dueDate && plannedDate > dayKey(new Date(item.dueDate)));
    return { ...item, manualRank: ranks.get(item.taskId), aiRank: aiRanks.get(item.taskId),
      plannedDate, plannedAfterDeadline, atRisk: item.atRisk || plannedAfterDeadline,
      shortfallHours: plannedAfterDeadline ? Math.max(item.shortfallHours, item.hours) : item.shortfallHours,
    };
  });
}
export function movePlanItem(preferences, visibleItems, taskId, direction) {
  const ids = visibleItems.map((item) => item.taskId);
  const at = ids.indexOf(taskId), next = at + direction;
  if (at < 0 || next < 0 || next >= ids.length) return preferences;
  const idsInGroup = new Set(ids);
  const remaining = preferences.order.filter((id) => !idsInGroup.has(id));
  const order = [...ids, ...remaining];
  const left = order.indexOf(ids[at]), right = order.indexOf(ids[next]);
  [order[left], order[right]] = [order[right], order[left]];
  return { ...preferences, order };
}

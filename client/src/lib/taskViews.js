export const TASK_VIEWS = ["board", "list", "table", "calendar"];
export const DEFAULT_TASK_FILTERS = { query: "", status: "all", assignee: "all", priority: "all", due: "all" };

export function readTaskView(userId, workspaceId) {
  try {
    const value = localStorage.getItem(`loft:task-view:${userId}:${workspaceId}`);
    return TASK_VIEWS.includes(value) ? value : "board";
  } catch { return "board"; }
}

export function saveTaskView(userId, workspaceId, value) {
  try { localStorage.setItem(`loft:task-view:${userId}:${workspaceId}`, value); }
  catch { /* View switching also works when browser storage is unavailable. */ }
}

// TaskModal saves date-picker values as ISO dates. Keep their calendar date
// intact instead of shifting midnight UTC into the previous day locally.
export function taskDueKey(value) {
  if (!value) return "";
  const key = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatTaskDue(value) {
  const key = taskDueKey(value);
  if (!key) return "No due date";
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], { month: "short", day: "numeric", ...(year !== new Date().getFullYear() ? { year: "numeric" } : {}) });
}

export function isTaskOverdue(task, statuses, now = new Date()) {
  const due = taskDueKey(task.dueDate);
  return !!due && due < localDateKey(now) && !statuses.find((status) => status.id === task.status)?.isDone;
}

export function filterTasks(tasks, filters, statuses, userId, now = new Date()) {
  const needle = filters.query.trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    if (needle && ![task.title, task.description, task.assignee?.name].some((value) => value?.toLocaleLowerCase().includes(needle))) return false;
    if (filters.status !== "all" && task.status !== filters.status) return false;
    if (filters.priority !== "all" && task.tier !== filters.priority) return false;
    if (filters.assignee === "mine" && task.assignee?.id !== userId) return false;
    if (filters.assignee === "unassigned" && task.assignee) return false;
    if (!["all", "mine", "unassigned"].includes(filters.assignee) && task.assignee?.id !== filters.assignee) return false;
    if (filters.due === "overdue" && !isTaskOverdue(task, statuses, now)) return false;
    if (filters.due === "today" && taskDueKey(task.dueDate) !== localDateKey(now)) return false;
    if (filters.due === "undated" && task.dueDate) return false;
    return true;
  });
}

export function sortTasks(tasks, { key = "order", direction = "asc" } = {}, statuses = []) {
  const statusRanks = new Map(statuses.map((status, index) => [status.id, index]));
  const rank = (task) => statusRanks.get(task.status) ?? statuses.length;
  const priorityRanks = { TIER_1: 1, TIER_2: 2, TIER_3: 3, TIER_4: 4 };
  const compareText = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  return [...tasks].sort((a, b) => {
    // Missing values stay at the end in either direction.
    if (key === "dueDate" && (!a.dueDate || !b.dueDate)) {
      if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
    }
    if (key === "assignee" && (!a.assignee || !b.assignee)) {
      if (!!a.assignee !== !!b.assignee) return a.assignee ? -1 : 1;
    }
    let result = 0;
    if (key === "title") result = compareText(a.title, b.title);
    else if (key === "status") result = rank(a) - rank(b);
    else if (key === "priority") result = (priorityRanks[a.tier] || 3) - (priorityRanks[b.tier] || 3);
    else if (key === "assignee") result = compareText(a.assignee?.name || "", b.assignee?.name || "");
    else if (key === "dueDate") result = compareText(taskDueKey(a.dueDate), taskDueKey(b.dueDate));
    else if (key === "estimate") result = (a.estimatedMinutes || 0) - (b.estimatedMinutes || 0);
    else result = rank(a) - rank(b) || (a.order || 0) - (b.order || 0);
    return result * (direction === "desc" ? -1 : 1) || compareText(a.title, b.title) || a.id.localeCompare(b.id);
  });
}

export function taskDropOrder(tasks, visibleTasks, taskId, status, indicatorIndex) {
  const visible = visibleTasks.filter((task) => task.status === status).sort((a, b) => a.order - b.order);
  const from = visible.findIndex((task) => task.id === taskId);
  const position = Math.max(0, indicatorIndex - (from >= 0 && from < indicatorIndex ? 1 : 0));
  const target = visible.filter((task) => task.id !== taskId);
  const all = tasks.filter((task) => task.status === status && task.id !== taskId).sort((a, b) => a.order - b.order);
  const next = target[position];
  const insertAt = next ? all.findIndex((task) => task.id === next.id) : all.length;
  const before = all[insertAt - 1], after = all[insertAt];
  return before && after ? (before.order + after.order) / 2 : before ? before.order + 1 : after ? after.order - 1 : 1;
}

export function formatTaskEstimate(minutes) {
  const value = Number(minutes) || 0;
  const hours = Math.floor(value / 60), rest = value % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}

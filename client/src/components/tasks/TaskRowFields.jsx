import { Pin, Moon } from "lucide-react";
import Avatar from "../common/Avatar.jsx";
import Select from "../common/Select.jsx";
import { displayColor } from "../../lib/colors.js";
import { formatTaskDue, isTaskOverdue } from "../../lib/taskViews.js";

export function TaskTitle({ task, onOpen }) {
  return <div className="min-w-0">
    <button type="button" onClick={() => onOpen(task)} className="flex max-w-full items-center gap-1.5 text-left text-sm font-medium text-ink-800 hover:text-brand-700 dark:text-ink-100 dark:hover:text-brand-300">
      {task.isPinned && <Pin aria-label="Pinned" className="h-3 w-3 shrink-0 text-brand-600 dark:text-brand-400" />}
      {task.isSnoozed && <Moon aria-label="Snoozed" className="h-3 w-3 shrink-0 text-ink-400" />}
      <span className="truncate">{task.title}</span>
    </button>
    {task.description && <p className="mt-0.5 truncate text-xs text-ink-400">{task.description}</p>}
  </div>;
}

export function TaskStatusField({ task, statuses, canMoveTask, onStatusChange, saving }) {
  const options = statuses.map((status) => ({ value: status.id, label: status.label, icon: <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: displayColor(status.color) }} /> }));
  if (!options.some((option) => option.value === task.status)) options.push({ value: task.status, label: task.status });
  return <Select size="sm" aria-label={`Status of ${task.title}`} value={task.status} onChange={(status) => onStatusChange(task, status)} options={options}
    disabled={saving || !canMoveTask(task)} title={saving ? "Saving status…" : !canMoveTask(task) ? "Only the assignee or someone with access can change this status" : "Change status"} className="max-w-[11rem]" />;
}

export function TaskAssignee({ task }) {
  return task.assignee ? <span className="inline-flex max-w-full items-center gap-2" title={task.assignee.name}>
    <Avatar name={task.assignee.name} color={task.assignee.avatarColor} src={task.assignee.avatarUrl} size={22} /><span className="truncate text-xs text-ink-600 dark:text-ink-300">{task.assignee.name}</span>
  </span> : <span className="text-xs text-ink-400">Unassigned</span>;
}

export function TaskDue({ task, statuses }) {
  const overdue = isTaskOverdue(task, statuses);
  return <span className={`whitespace-nowrap text-xs ${overdue ? "font-medium text-red-600 dark:text-red-400" : "text-ink-500 dark:text-ink-400"}`}>
    {overdue ? "Overdue · " : ""}{task.dueDate ? <time dateTime={task.dueDate}>{formatTaskDue(task.dueDate)}</time> : "No due date"}
  </span>;
}

import { useState } from "react";
import { ChevronDown, ChevronRight, Clock3, Pencil } from "lucide-react";
import { TierBadge } from "../common/Badges.jsx";
import { displayColor } from "../../lib/colors.js";
import { formatTaskEstimate } from "../../lib/taskViews.js";
import { TaskTitle, TaskStatusField, TaskAssignee, TaskDue } from "./TaskRowFields.jsx";

export default function TaskListView({ tasks, statuses, groupBy, onOpen, onEdit, canMoveTask, onStatusChange, savingIds }) {
  const [collapsed, setCollapsed] = useState(new Set());
  let groups;
  if (groupBy === "status") {
    const definitions = [...statuses, ...[...new Set(tasks.map((task) => task.status))].filter((id) => !statuses.some((status) => status.id === id)).map((id) => ({ id, label: id }))];
    groups = definitions.map((status) => ({ id: status.id, label: status.label, color: status.color, tasks: tasks.filter((task) => task.status === status.id) }));
  } else if (groupBy === "assignee") {
    const people = new Map(tasks.map((task) => [task.assignee?.id || "unassigned", task.assignee]));
    groups = [...people].sort((a, b) => !a[1] ? 1 : !b[1] ? -1 : a[1].name.localeCompare(b[1].name)).map(([id, person]) => ({
      id, label: person?.name || "Unassigned", color: person?.avatarColor, tasks: tasks.filter((task) => (task.assignee?.id || "unassigned") === id),
    }));
  } else groups = [{ id: "all", label: "All tasks", tasks }];

  return <div aria-label="Task list" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-20">
    {groups.filter((group) => group.tasks.length).map((group) => {
      const key = `${groupBy}:${group.id}`;
      const closed = collapsed.has(key);
      return <section key={key} className="overflow-hidden rounded-xl border border-ink-200 bg-white/70 dark:border-white/10 dark:bg-ink-900/60">
        <button type="button" aria-expanded={!closed} onClick={() => setCollapsed((prev) => {
          const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next;
        })} className="flex w-full items-center gap-2 border-b border-ink-200/70 bg-ink-50/70 px-4 py-3 text-left dark:border-white/5 dark:bg-white/[0.03]">
          {closed ? <ChevronRight className="h-3.5 w-3.5 text-ink-400" /> : <ChevronDown className="h-3.5 w-3.5 text-ink-400" />}
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: displayColor(group.color) }} />
          <span className="min-w-0 truncate text-sm font-semibold text-ink-700 dark:text-ink-200">{group.label}</span>
          <span className="ml-1 text-xs tabular-nums text-ink-400">{group.tasks.length}</span>
        </button>
        {!closed && <div className="divide-y divide-ink-200/70 dark:divide-white/5">
          {group.tasks.map((task) => <div key={task.id} data-task-id={task.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-ink-50/70 dark:hover:bg-white/[0.03] ${task.isSnoozed ? "opacity-60" : ""}`}>
            <div className="min-w-0 flex-1 basis-full sm:basis-52"><TaskTitle task={task} onOpen={onOpen} /></div>
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <TaskStatusField task={task} statuses={statuses} canMoveTask={canMoveTask} onStatusChange={onStatusChange} saving={savingIds.has(task.id)} />
              <TierBadge tier={task.tier} compact />
              <TaskDue task={task} statuses={statuses} />
              <span className="inline-flex items-center gap-1 text-xs tabular-nums text-ink-400" title="Estimated duration"><Clock3 className="h-3 w-3" />{formatTaskEstimate(task.estimatedMinutes)}</span>
              <span className="max-w-[10rem]"><TaskAssignee task={task} /></span>
              <button type="button" onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`} title="Edit task" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-ink-100"><Pencil className="h-3.5 w-3.5" /></button>
            </div>
          </div>)}
        </div>}
      </section>;
    })}
  </div>;
}

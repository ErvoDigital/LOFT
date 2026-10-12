import { ArrowUp, ArrowDown, ArrowUpDown, Columns3, Pencil } from "lucide-react";
import { TierBadge } from "../common/Badges.jsx";
import { formatTaskEstimate } from "../../lib/taskViews.js";
import { TaskTitle, TaskStatusField, TaskAssignee, TaskDue } from "./TaskRowFields.jsx";

export const TASK_TABLE_COLUMNS = [
  { key: "status", label: "Status" }, { key: "priority", label: "Priority" },
  { key: "assignee", label: "Assignee" }, { key: "dueDate", label: "Due date" }, { key: "estimate", label: "Estimate" },
];

export default function TaskTableView({ tasks, statuses, sort, onSortChange, visibleColumns, onColumnsChange, onOpen, onEdit, canMoveTask, onStatusChange, savingIds }) {
  const columns = [{ key: "title", label: "Task" }, ...TASK_TABLE_COLUMNS.filter((column) => visibleColumns.includes(column.key))];
  return <div className="flex min-h-0 flex-1 flex-col gap-2">
    <div className="flex shrink-0 justify-end">
      <details className="relative" onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.open = false; }}>
        <summary className="btn-secondary cursor-pointer list-none !gap-1.5 !px-2.5 !py-1.5 text-xs"><Columns3 className="h-3.5 w-3.5" />Columns</summary>
        <fieldset className="dropdown-panel absolute right-0 top-full z-20 mt-1 w-44 rounded-xl p-2">
          <legend className="sr-only">Visible table columns</legend>
          {TASK_TABLE_COLUMNS.map((column) => <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700">
            <input type="checkbox" checked={visibleColumns.includes(column.key)} onChange={(e) => onColumnsChange(e.target.checked ? [...visibleColumns, column.key] : visibleColumns.filter((key) => key !== column.key))} className="accent-brand-600" />{column.label}
          </label>)}
        </fieldset>
      </details>
    </div>
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-xl border border-ink-200 bg-white/70 pb-20 dark:border-white/10 dark:bg-ink-900/60" tabIndex={0} aria-label="Task table, scroll to see all columns">
      <table className="w-full border-separate border-spacing-0 text-left" style={{ minWidth: 280 + (columns.length - 1) * 140 }}>
        <caption className="sr-only">Workspace tasks. Select a task to open its details or use a column heading to sort.</caption>
        <thead className="sticky top-0 z-10">
          <tr>{columns.map((column) => <th key={column.key} scope="col" aria-sort={sort.key === column.key ? sort.direction === "asc" ? "ascending" : "descending" : "none"} className="border-b border-ink-200 bg-ink-50 px-4 py-3 text-xs font-semibold text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
            <button type="button" aria-label={`Sort by ${column.label.toLowerCase()}`} onClick={() => onSortChange({ key: column.key, direction: sort.key === column.key && sort.direction === "asc" ? "desc" : "asc" })} className="flex items-center gap-2 hover:text-brand-700 dark:hover:text-brand-300">
              {column.label}{sort.key === column.key ? sort.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 text-ink-300 dark:text-ink-500" />}
            </button>
          </th>)}<th scope="col" className="border-b border-ink-200 bg-ink-50 px-3 dark:border-ink-700 dark:bg-ink-800"><span className="sr-only">Actions</span></th></tr>
        </thead>
        <tbody>
          {tasks.map((task) => <tr key={task.id} data-task-id={task.id} className={`group hover:bg-ink-50/70 dark:hover:bg-white/[0.03] ${task.isSnoozed ? "opacity-60" : ""}`}>
            {columns.map((column) => <td key={column.key} className={`border-b border-ink-200/60 px-4 py-3 align-middle last:border-b-0 dark:border-white/5 ${column.key === "title" ? "min-w-[240px] max-w-[420px]" : ""}`}>
              {column.key === "title" ? <TaskTitle task={task} onOpen={onOpen} /> : column.key === "status" ? <TaskStatusField task={task} statuses={statuses} canMoveTask={canMoveTask} onStatusChange={onStatusChange} saving={savingIds.has(task.id)} /> : column.key === "priority" ? <TierBadge tier={task.tier} compact /> : column.key === "assignee" ? <TaskAssignee task={task} /> : column.key === "dueDate" ? <TaskDue task={task} statuses={statuses} /> : <span className="text-xs tabular-nums text-ink-500 dark:text-ink-400">{formatTaskEstimate(task.estimatedMinutes)}</span>}
            </td>)}
            <td className="border-b border-ink-200/60 px-3 py-3 dark:border-white/5"><button type="button" onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`} title="Edit task" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-ink-100"><Pencil className="h-3.5 w-3.5" /></button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}

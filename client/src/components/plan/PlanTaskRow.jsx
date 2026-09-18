import { Pin, Moon } from "lucide-react";
import { TierBadge } from "../common/Badges.jsx";
import { displayColor } from "../../lib/colors.js";

export default function PlanTaskRow({ item, statuses, onStatusChange, onTogglePin, onToggleSnooze, onTaskClick }) {
  const overdue = item.dueDate && new Date(item.dueDate) < new Date(new Date().toDateString());

  return (
    <div className={`flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-ink-50 dark:hover:bg-ink-700 ${item.isSnoozed ? "opacity-60" : ""}`}>
      <div className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: displayColor(item.workspaceColor) }} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onTaskClick(item)}
          className="flex w-full items-center gap-1 text-left text-sm font-medium text-ink-800 hover:text-brand-700 dark:text-ink-100"
        >
          <span className="truncate">{item.title}</span>
        </button>
        <p className="truncate text-xs text-ink-400">
          {item.workspaceName}
          {item.dueDate && (
            <span className={overdue ? "text-red-500" : ""}>
              {" · "}
              {overdue ? "Overdue " : "Due "}
              {new Date(item.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
            </span>
          )}
          {item.overflow && <span className="text-red-500"> · pushed past due date</span>}
          {item.someday && <span> · no due date</span>}
        </p>
      </div>
      <span className="shrink-0 text-xs font-medium text-ink-400">{item.hours}h</span>
      <TierBadge tier={item.tier} compact />
      {statuses && statuses.length > 0 ? (
        <select
          className="shrink-0 rounded-md border border-ink-200 bg-white px-1.5 py-1 text-xs font-medium text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300"
          value={item.status}
          onChange={(e) => onStatusChange(item, e.target.value)}
          title="Status"
        >
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      ) : (
        <span className="shrink-0 text-xs font-medium text-ink-400">{item.status}</span>
      )}
      <button
        type="button"
        onClick={() => onTogglePin(item)}
        title={item.isPinned ? "Unpin" : "Pin to top"}
        className={`shrink-0 rounded-md border p-1.5 transition-colors ${
          item.isPinned
            ? "border-brand-300 bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
            : "border-ink-200 text-ink-400 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-700"
        }`}
      >
        <Pin className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onToggleSnooze(item)}
        title={item.isSnoozed ? "Unsnooze" : "Snooze"}
        className={`shrink-0 rounded-md border p-1.5 transition-colors ${
          item.isSnoozed
            ? "border-ink-400 bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-300"
            : "border-ink-200 text-ink-400 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-700"
        }`}
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

import { Pin, Moon, Pencil } from "lucide-react";
import Avatar from "../common/Avatar.jsx";
import { TierBadge } from "../common/Badges.jsx";

function formatDuration(minutes) {
  const m = Number(minutes) || 0;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  if (rest === 0) return `${h}h`;
  return `${h}h ${rest}m`;
}

export default function TaskCard({ task, onClick, onEdit, dragHandlers, dragging, isDoneColumn }) {
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDoneColumn;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      draggable
      {...dragHandlers}
      className={`group w-full cursor-grab rounded-lg border bg-white p-3 text-left shadow-soft transition-all hover:border-brand-300 hover:shadow-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 active:cursor-grabbing ${
        task.isPinned ? "border-brand-300 ring-1 ring-brand-100" : "border-ink-200"
      } ${dragging ? "opacity-40" : ""} ${task.isSnoozed ? "opacity-60" : ""}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1 text-sm font-medium text-ink-800">
          {task.isPinned && <Pin className="h-3 w-3 shrink-0 text-brand-600" />}
          {task.isSnoozed && <Moon className="h-3 w-3 shrink-0 text-ink-400" />}
          <span className="truncate">{task.title}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <TierBadge tier={task.tier} compact />
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Edit task"
              className="rounded-md p-1 text-ink-300 opacity-0 transition-opacity hover:bg-ink-100 hover:text-ink-600 group-hover:opacity-100 focus:opacity-100"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {task.description && <p className="mb-2 line-clamp-2 text-xs text-ink-400">{task.description}</p>}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {task.dueDate ? (
            <span className={`shrink-0 text-xs font-medium ${overdue ? "text-red-500" : "text-ink-400"}`}>
              {overdue ? "Overdue · " : "Due "}
              {new Date(task.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
            </span>
          ) : (
            <span className="shrink-0 text-xs text-ink-300">No due date</span>
          )}
          <span className="shrink-0 text-xs text-ink-300">· {formatDuration(task.estimatedMinutes)}</span>
        </div>
        {task.assignee ? (
          <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size={22} />
        ) : (
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-dashed border-ink-200 text-[10px] text-ink-300">
            ?
          </span>
        )}
      </div>
    </div>
  );
}

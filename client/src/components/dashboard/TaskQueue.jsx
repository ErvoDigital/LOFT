import { Link } from "react-router-dom";
import { CheckSquare } from "lucide-react";
import Avatar from "../common/Avatar.jsx";
import { TierBadge } from "../common/Badges.jsx";
import EmptyState from "../common/EmptyState.jsx";
import { startOfDay } from "./fortnight.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Group order, and how each group's date tile and heading dot are tinted.
const GROUPS = [
  {
    key: "overdue",
    label: "Overdue",
    dot: "bg-red-500",
    tile: "bg-red-500/10 text-red-600 ring-red-500/25 dark:text-red-400",
  },
  {
    key: "today",
    label: "Today",
    dot: "bg-accent-500",
    tile: "bg-accent-400/15 text-accent-700 ring-accent-500/30 dark:text-accent-300",
  },
  {
    key: "week",
    label: "This week",
    dot: "bg-brand-500",
    tile: "bg-brand-500/10 text-brand-700 ring-brand-500/20 dark:text-brand-300",
  },
  {
    key: "later",
    label: "Later",
    dot: "bg-ink-300 dark:bg-ink-600",
    tile: "bg-ink-900/[0.04] text-ink-600 ring-ink-900/[0.08] dark:bg-white/[0.05] dark:text-ink-300 dark:ring-white/[0.08]",
  },
];

function formatEstimate(minutes) {
  const m = Number(minutes) || 0;
  if (!m) return null;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

// Same cut as the server's summary counts: past its due time is overdue, even
// when that time was earlier today.
function bucketOf(due, now, today) {
  if (due < now) return "overdue";
  const days = Math.round((startOfDay(due) - today) / DAY_MS);
  if (days === 0) return "today";
  if (days < 7) return "week";
  return "later";
}

function dueLabel(due, bucket, today) {
  const days = Math.round((startOfDay(due) - today) / DAY_MS);
  if (bucket === "overdue") {
    if (days >= 0) return "Was due today";
    return `${-days} day${days === -1 ? "" : "s"} late`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (bucket === "week") return `Due ${due.toLocaleDateString([], { weekday: "long" })}`;
  return `Due ${due.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

function QueueRow({ task, bucket, tile, workspaceId, today }) {
  const due = new Date(task.dueDate);
  const estimate = formatEstimate(task.estimatedMinutes);
  const overdue = bucket === "overdue";

  return (
    <Link
      to={`/workspaces/${workspaceId}/tasks`}
      className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-brand-500/[0.07]"
    >
      <span
        className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ring-1 ring-inset ${tile}`}
        aria-hidden="true"
      >
        <span className="text-[9px] font-semibold uppercase leading-none tracking-wider opacity-80">
          {due.toLocaleDateString([], { month: "short" })}
        </span>
        <span className="mt-0.5 text-base font-semibold leading-none tabular-nums">{due.getDate()}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-800 group-hover:text-brand-700 dark:text-ink-100 dark:group-hover:text-brand-300">
          {task.title}
        </p>
        <p className="truncate text-xs text-ink-500 dark:text-ink-400">
          <span className={overdue ? "font-medium text-red-600 dark:text-red-400" : ""}>
            {dueLabel(due, bucket, today)}
          </span>
          {estimate && ` · ${estimate}`}
        </p>
      </div>
      <TierBadge tier={task.tier} compact />
      {task.assignee ? (
        <span title={task.assignee.name}>
          <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size={24} />
        </span>
      ) : (
        <span
          title="Unassigned"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-ink-300 text-[10px] text-ink-400 dark:border-ink-600"
        >
          ?
        </span>
      )}
    </Link>
  );
}

// The soonest-due open tasks, sorted into overdue / today / this week / later
// so the list reads as "what to do first" rather than a flat date column.
export default function TaskQueue({ tasks, openCount = 0, workspaceId, className = "" }) {
  const now = new Date();
  const today = startOfDay(now);
  const list = (tasks || []).filter((t) => t.dueDate);

  const grouped = GROUPS.map((g) => ({
    ...g,
    tasks: list.filter((t) => bucketOf(new Date(t.dueDate), now, today) === g.key),
  })).filter((g) => g.tasks.length > 0);
  const rest = Math.max(openCount - list.length, 0);

  return (
    <section className={`card flex flex-col p-5 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">Up next</h3>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">Open tasks by due date, most urgent first</p>
        </div>
        <Link
          to={`/workspaces/${workspaceId}/tasks`}
          className="shrink-0 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          View board
        </Link>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="h-5 w-5" />}
          title="Nothing due soon"
          description="Open tasks with a due date line up here, most urgent first."
        />
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => (
            <div key={g.key}>
              <p className="mb-0.5 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                <span className={`h-1.5 w-1.5 rounded-full ${g.dot}`} aria-hidden="true" />
                {g.label}
                <span className="font-medium tabular-nums text-ink-400 dark:text-ink-500">{g.tasks.length}</span>
              </p>
              <div className="space-y-0.5">
                {g.tasks.map((t) => (
                  <QueueRow key={t.id} task={t} bucket={g.key} tile={g.tile} workspaceId={workspaceId} today={today} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {rest > 0 && grouped.length > 0 && (
        <div className="mt-auto pt-3">
          <p className="border-t border-ink-900/[0.06] px-2 pt-3 text-xs text-ink-500 dark:border-white/[0.06] dark:text-ink-400">
            {rest} more open task{rest === 1 ? "" : "s"} on the board.{" "}
            <Link
              to={`/workspaces/${workspaceId}/tasks`}
              className="font-medium text-brand-600 hover:underline dark:text-brand-300"
            >
              Open board
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}

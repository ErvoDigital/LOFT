import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { displayColor } from "../../lib/colors.js";
import Avatar from "../common/Avatar.jsx";
import { TierBadge } from "../common/Badges.jsx";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_MS = 24 * 60 * 60 * 1000;
// Up to this many tasks are listed by title in the day cell; beyond it they
// collapse into a count square with the full list on hover.
const INLINE_TASK_LIMIT = 2;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function onDay(value, day) {
  const t = new Date(value);
  return t >= day && t < new Date(day.getTime() + DAY_MS);
}

function TaskChip({ task, workspaceId }) {
  return (
    <Link
      to={`/workspaces/${workspaceId}/tasks`}
      title={task.title}
      className="flex w-full min-w-0 items-center gap-1 rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 transition-colors hover:bg-brand-500/20 dark:text-brand-300"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-[2px] bg-brand-500" />
      <span className="truncate">{task.title}</span>
    </Link>
  );
}

function TaskOverflow({ tasks, day, workspaceId, align }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);

  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  // A short grace period so the pointer can cross from the square into the list.
  const hide = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const dayLabel = day.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  // Edge columns anchor to their own side so the list doesn't run off the strip.
  const position = align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <div
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) hide();
      }}
    >
      {/* Opens rather than toggles: on touch, a tap fires mouseenter and click
          together, and a toggle would close the list the instant it opened. */}
      <button
        type="button"
        onClick={show}
        aria-expanded={open}
        aria-label={`${tasks.length} tasks due ${dayLabel}`}
        className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-brand-500/15 px-1.5 text-[11px] font-bold tabular-nums text-brand-700 ring-1 ring-brand-400/40 transition-colors hover:bg-brand-500/25 dark:text-brand-300"
      >
        {tasks.length}
      </button>

      {open && (
        <div className={`absolute top-full z-30 w-64 pt-2 ${position}`}>
          {/* Solid, not `.card` glass: this sits inside the strip's blurred card,
              and a backdrop-filter nested in another can only blur what's inside
              that parent — the stat cards below would show straight through. */}
          <div
            className="animate-slide-fade-in rounded-2xl border border-ink-200/70 bg-white p-1.5 shadow-glass-lg dark:border-white/[0.08] dark:bg-ink-900"
            role="group"
            aria-label={`Tasks due ${dayLabel}`}
          >
            <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold text-ink-500 dark:text-ink-400">
              {tasks.length} tasks due · {dayLabel}
            </p>
            <ul className="max-h-64 space-y-0.5 overflow-y-auto">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/workspaces/${workspaceId}/tasks`}
                    title={t.title}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-brand-500/10"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-700 dark:text-ink-200">{t.title}</span>
                    <TierBadge tier={t.tier} compact />
                    {t.assignee && <Avatar name={t.assignee.name} color={t.assignee.avatarColor} size={18} />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// Seven-day horizontal strip. Events show as up to three dots — dots, not
// chevrons or arrows, carry the density signal — and tasks due that day sit
// underneath, by title or as a count square once there are too many to list.
export default function ScheduleStrip({ events, tasks, workspaceId, accentColor }) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => new Date(today.getTime() + i * DAY_MS));

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, i) => {
        const dayEvents = (events || []).filter((e) => onDay(e.startTime, day));
        const dayTasks = (tasks || []).filter((t) => onDay(t.dueDate, day));
        const isToday = i === 0;
        const align = i < 2 ? "start" : i > 4 ? "end" : "center";

        return (
          <div
            key={day.toISOString()}
            className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 transition-all ${
              isToday
                ? "border-brand-400/50 bg-brand-500/10 ring-1 ring-brand-400/30"
                : "border-white/50 bg-white/40 hover:border-brand-400/40 hover:bg-brand-500/[0.07] dark:border-white/[0.06] dark:bg-white/[0.03]"
            }`}
          >
            <Link
              to={`/workspaces/${workspaceId}/calendar`}
              title={
                dayEvents.length
                  ? dayEvents.map((e) => e.title).join(", ")
                  : `No events ${day.toLocaleDateString([], { month: "short", day: "numeric" })}`
              }
              className="flex w-full flex-col items-center gap-1.5 rounded-lg"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                {DAY_LABELS[day.getDay()]}
              </span>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  isToday ? "text-brand-600 dark:text-brand-300" : "text-ink-700 dark:text-ink-200"
                }`}
              >
                {day.getDate()}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: displayColor(accentColor) }}
                  />
                ))}
              </span>
            </Link>

            {dayTasks.length > INLINE_TASK_LIMIT ? (
              <TaskOverflow tasks={dayTasks} day={day} workspaceId={workspaceId} align={align} />
            ) : (
              dayTasks.length > 0 && (
                <div className="flex w-full flex-col gap-1">
                  {dayTasks.map((t) => (
                    <TaskChip key={t.id} task={t} workspaceId={workspaceId} />
                  ))}
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

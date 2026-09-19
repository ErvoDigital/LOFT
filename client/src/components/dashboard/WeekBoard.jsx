import { Link } from "react-router-dom";
import { TIER_META } from "../common/Badges.jsx";
import { displayColor } from "../../lib/colors.js";

// Items a day column lists before the rest collapse into a count.
const DAY_LIMIT = 4;

const TIER_SWATCH = {
  TIER_1: "bg-red-500",
  TIER_2: "bg-accent-500",
  TIER_3: "bg-brand-500",
  TIER_4: "bg-ink-300 dark:bg-ink-500",
};

function timeOf(value) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function EventItem({ event, workspaceId, color }) {
  return (
    <Link
      to={`/workspaces/${workspaceId}/calendar`}
      title={`${event.title} · ${timeOf(event.startTime)}–${timeOf(event.endTime)}`}
      className="block rounded-lg border-l-[3px] bg-white/80 px-2 py-1.5 shadow-soft transition-colors hover:bg-white dark:bg-white/[0.06] dark:shadow-none dark:hover:bg-white/[0.1]"
      style={{ borderLeftColor: color }}
    >
      <p className="text-[10px] font-semibold tabular-nums text-ink-500 dark:text-ink-400">{timeOf(event.startTime)}</p>
      <p className="truncate text-xs font-medium text-ink-800 dark:text-ink-100">{event.title}</p>
    </Link>
  );
}

function TaskItem({ task, workspaceId }) {
  const tier = TIER_META[task.tier] || TIER_META.TIER_3;
  return (
    <Link
      to={`/workspaces/${workspaceId}/tasks`}
      title={`${task.title} · ${tier.label}`}
      className="flex min-w-0 items-center gap-1.5 rounded-lg bg-brand-500/[0.08] px-2 py-1 text-xs font-medium text-ink-700 transition-colors hover:bg-brand-500/[0.16] dark:text-ink-200"
    >
      <span className={`h-2 w-2 shrink-0 rounded-[2px] ${TIER_SWATCH[task.tier] || TIER_SWATCH.TIER_3}`} aria-hidden="true" />
      <span className="truncate">{task.title}</span>
    </Link>
  );
}

function DayColumn({ day, workspaceId, color }) {
  const isToday = day.index === 0;
  const weekend = day.date.getDay() === 0 || day.date.getDay() === 6;
  const items = [
    ...day.meetings.map((e) => ({ kind: "event", item: e })),
    ...day.deadlines.map((t) => ({ kind: "task", item: t })),
  ];
  const shown = items.slice(0, DAY_LIMIT);
  const hidden = items.length - shown.length;
  const fullDate = day.date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  let ground = "border-ink-900/[0.06] bg-white/45 dark:border-white/[0.05] dark:bg-white/[0.025]";
  if (isToday) {
    ground = "border-brand-400/50 bg-brand-500/[0.08] ring-1 ring-inset ring-brand-400/20 dark:border-brand-400/30";
  } else if (weekend) {
    // Weekends are hatched rather than dimmed, so their items stay readable.
    ground =
      "border-ink-900/[0.05] bg-[repeating-linear-gradient(135deg,rgb(var(--ink-500)/0.07)_0_1px,transparent_1px_9px)] dark:border-white/[0.04] dark:bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.035)_0_1px,transparent_1px_9px)]";
  }

  return (
    <li aria-label={fullDate} className={`flex min-h-[10.5rem] min-w-0 flex-col rounded-xl border p-2.5 ${ground}`}>
      <div className="mb-2.5 flex items-start justify-between gap-1">
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider ${
            isToday ? "text-brand-600 dark:text-brand-300" : "text-ink-500 dark:text-ink-400"
          }`}
        >
          {day.date.toLocaleDateString([], { weekday: "short" })}
        </span>
        {isToday && (
          <span className="brand-mark rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Today
          </span>
        )}
      </div>
      <p
        className={`text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums ${
          isToday ? "text-brand-600 dark:text-brand-300" : "text-ink-800 dark:text-ink-100"
        }`}
        aria-hidden="true"
      >
        {day.date.getDate()}
      </p>

      <div className="mt-3 flex flex-1 flex-col gap-1.5">
        {shown.map(({ kind, item }) =>
          kind === "event" ? (
            <EventItem key={`e-${item.id}`} event={item} workspaceId={workspaceId} color={color} />
          ) : (
            <TaskItem key={`t-${item.id}`} task={item} workspaceId={workspaceId} />
          )
        )}
        {hidden > 0 && (
          <Link
            to={`/workspaces/${workspaceId}/calendar`}
            className="px-1 text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300"
          >
            {hidden} more
          </Link>
        )}
        {items.length === 0 && (
          <p className="mt-auto px-0.5 text-[11px] text-ink-400 dark:text-ink-500">{weekend ? "Weekend" : "Open"}</p>
        )}
      </div>
    </li>
  );
}

// The coming seven days as columns, each listing its events by start time
// (edged in the workspace color) and the tasks due that day (marked by tier).
export default function WeekBoard({ days, workspaceId, accentColor, className = "" }) {
  const color = displayColor(accentColor);
  const events = days.reduce((n, d) => n + d.meetings.length, 0);
  const due = days.reduce((n, d) => n + d.deadlines.length, 0);
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const range = `${first.toLocaleDateString([], { month: "short", day: "numeric" })} – ${last.toLocaleDateString([], {
    month: first.getMonth() === last.getMonth() ? undefined : "short",
    day: "numeric",
  })}`;

  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">This week</h3>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
            {range} · {events} event{events === 1 ? "" : "s"} · {due} due
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-3 text-[11px] text-ink-500 dark:text-ink-400 sm:flex" aria-hidden="true">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-[3px] rounded-full" style={{ backgroundColor: color }} /> Event
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex gap-0.5">
                <span className="h-2 w-2 rounded-[2px] bg-red-500" />
                <span className="h-2 w-2 rounded-[2px] bg-accent-500" />
                <span className="h-2 w-2 rounded-[2px] bg-brand-500" />
              </span>
              Task due, by tier
            </span>
          </div>
          <Link
            to={`/workspaces/${workspaceId}/calendar`}
            className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
          >
            Full calendar
          </Link>
        </div>
      </div>

      {/* Below ~52rem the columns scroll sideways rather than squeezing titles
          down to a letter or two. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
        <ol className="grid min-w-[52rem] grid-cols-7 gap-2">
          {days.map((day) => (
            <DayColumn key={day.key} day={day} workspaceId={workspaceId} color={color} />
          ))}
        </ol>
      </div>
    </section>
  );
}

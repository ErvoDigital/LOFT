import { AlarmClock, Infinity as Undated } from "lucide-react";
import PlanTaskRow from "./PlanTaskRow.jsx";
import { daysLate, formatHours, relativeDayName } from "./planModel.js";

// Both the tile column and the spine in PlanTimeline are sized off this, so
// the spine runs through the middle of every tile.
export const LANE_GRID = "grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-4";

function DateTile({ lane }) {
  const base = "flex h-16 w-full flex-col items-center justify-center rounded-2xl sm:h-[4.5rem]";

  if (lane.kind === "overdue") {
    return (
      <div className={`${base} gap-1 bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white shadow-[0_4px_12px_-3px_rgba(220,38,38,0.5)]`}>
        <AlarmClock className="h-4 w-4" aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">Late</span>
      </div>
    );
  }
  if (lane.kind === "undated") {
    return (
      <div className={`${base} gap-1 border border-dashed border-ink-300 bg-white/60 text-ink-500 dark:border-white/15 dark:bg-white/[0.04] dark:text-ink-400`}>
        <Undated className="h-4 w-4" aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">Open</span>
      </div>
    );
  }

  const isToday = lane.offset === 0;
  return (
    <div
      className={`${base} ${
        isToday
          ? "brand-mark text-white shadow-glow"
          : "border border-white/70 bg-white/90 text-ink-800 shadow-glass dark:border-white/[0.08] dark:bg-ink-900/90 dark:text-ink-100"
      }`}
    >
      <span className={`text-[10px] font-semibold uppercase tracking-wider ${isToday ? "text-white/80" : "text-ink-400"}`}>
        {lane.date.toLocaleDateString([], { weekday: "short" })}
      </span>
      <span className="text-xl font-semibold leading-tight tabular-nums">{lane.date.getDate()}</span>
      <span className={`text-[10px] font-medium uppercase tracking-wider ${isToday ? "text-white/80" : "text-ink-400"}`}>
        {lane.date.toLocaleDateString([], { month: "short" })}
      </span>
    </div>
  );
}

function laneHeading(lane) {
  if (lane.kind === "overdue") return { title: "Overdue", subtitle: "Past their due date, ranked against each other" };
  if (lane.kind === "undated") return { title: "No due date", subtitle: "No deadline, so ranked by tier" };
  const full = lane.date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const subtitle = lane.offset > 1 ? `${lane.date.toLocaleDateString([], { month: "long", day: "numeric" })} · in ${lane.offset} days` : full;
  return { title: relativeDayName(lane.offset, lane.date), subtitle };
}

// Day lanes measure what's due against the daily hours; the overdue and
// no-date lanes aren't a single day, so they only total up.
function LaneLoad({ lane, capacity }) {
  const count = `${lane.items.length} task${lane.items.length === 1 ? "" : "s"}`;
  if (lane.kind !== "day") {
    return (
      <p className="text-xs font-medium text-ink-500 dark:text-ink-400">
        {count} · {formatHours(lane.hours)}
      </p>
    );
  }
  const over = lane.hours - capacity;
  return (
    <div className="w-full sm:w-44">
      <p className={`flex justify-between gap-3 text-xs font-medium ${over > 0 ? "text-accent-600 dark:text-accent-400" : "text-ink-500 dark:text-ink-400"}`}>
        <span>{count}</span>
        <span className="tabular-nums">{over > 0 ? `${formatHours(over)} over` : `${formatHours(lane.hours)} of ${capacity}h`}</span>
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-900/[0.07] dark:bg-white/[0.08]">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${over > 0 ? "bg-accent-500" : "bg-gradient-to-r from-brand-400 to-brand-600"}`}
          style={{ width: `${Math.min(100, (lane.hours / capacity) * 100)}%` }}
        />
      </div>
    </div>
  );
}

// One row of the Day-by-day timeline: a date tile on the spine and a card of
// that day's tasks, ranked 1..n among themselves only.
export default function PlanDayGroup({ lane, capacity, statusesByWorkspace, onStatusChange, onTogglePin, onToggleSnooze, onTaskClick }) {
  const { title, subtitle } = laneHeading(lane);
  const isToday = lane.kind === "day" && lane.offset === 0;
  const empty = lane.items.length === 0;

  let cardTone = "";
  if (isToday) cardTone = "!border-brand-400/50 ring-1 ring-brand-500/20";
  else if (lane.kind === "overdue") cardTone = "danger-wash !border-red-300/70 dark:!border-red-500/25";
  if (empty) cardTone += " !border-dashed";

  return (
    <li className={LANE_GRID}>
      {/* The tile rides down the lane while its tasks scroll past. */}
      <div>
        <div className="sticky top-4 z-[1]">
          <DateTile lane={lane} />
        </div>
      </div>

      <section className={`card min-w-0 p-3 sm:p-4 ${cardTone}`} aria-label={title}>
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-2">
          <div className="min-w-0">
            <h3 className={`text-base font-semibold ${lane.kind === "overdue" ? "text-red-600 dark:text-red-400" : "text-ink-900 dark:text-ink-50"}`}>
              {title}
            </h3>
            <p className="text-xs text-ink-500 dark:text-ink-400">{subtitle}</p>
          </div>
          {!empty && <LaneLoad lane={lane} capacity={capacity} />}
        </header>

        {empty ? (
          <p className="px-2 pb-1 pt-3 text-sm text-ink-500 dark:text-ink-400">
            Nothing due {isToday ? "today" : "tomorrow"}. A clear day.
          </p>
        ) : (
          <div className="mt-3 space-y-0.5">
            {lane.items.map((item, i) => (
              <PlanTaskRow
                key={item.taskId}
                item={item}
                rank={i + 1}
                highlight={i === 0}
                when={lane.kind === "overdue" ? `due ${new Date(item.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}, ${daysLate(item)}d late` : undefined}
                whenTone="danger"
                statuses={statusesByWorkspace?.[item.workspaceId]}
                onStatusChange={onStatusChange}
                onTogglePin={onTogglePin}
                onToggleSnooze={onToggleSnooze}
                onTaskClick={onTaskClick}
              />
            ))}
          </div>
        )}
      </section>
    </li>
  );
}

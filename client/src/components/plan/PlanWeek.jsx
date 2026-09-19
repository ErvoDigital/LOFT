import { useMemo, useState } from "react";
import { AlarmClock, CalendarRange } from "lucide-react";
import PlanTaskRow from "./PlanTaskRow.jsx";
import EmptyState from "../common/EmptyState.jsx";
import { TIER_META } from "../common/Badges.jsx";
import { buildWeek, formatHours, shortDay, whenLabel } from "./planModel.js";

// Tier fills for the load bars, matching TierBadge's hues.
const TIER_FILL = {
  TIER_1: "bg-red-500",
  TIER_2: "bg-accent-500",
  TIER_3: "bg-brand-500",
  TIER_4: "bg-ink-400 dark:bg-ink-500",
};
const TOP_OF_WEEK = 3;

function pageCaption(page) {
  if (page === 0) return "Next 7 days";
  if (page === 1) return "The following week";
  return `${page} weeks ahead`;
}

function rangeLabel(start, end) {
  const fmt = { weekday: "short", month: "short", day: "numeric" };
  return `${start.toLocaleDateString([], fmt)} – ${end.toLocaleDateString([], fmt)}`;
}

function taskCount(n) {
  return `${n} task${n === 1 ? "" : "s"}`;
}

// One column of the week chart. The bar's full height is the daily hours
// setting, and each task is a block sized by its estimate, stacked in rank
// order from the bottom. A day past its hours gets an amber rim and is
// scaled to its own total instead, so an overbooked day still shows every
// task rather than clipping all but the first.
function DayColumn({ column, capacity, selected, onSelect }) {
  const over = column.hours > capacity;
  const scale = Math.max(capacity, column.hours);
  const late = column.key === "overdue";
  const weekend = !late && (column.date.getDay() === 0 || column.date.getDay() === 6);
  const isToday = !late && column.offset === 0;
  const name = late
    ? "Overdue"
    : column.date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${name}: ${column.items.length ? `${taskCount(column.items.length)}, ${formatHours(column.hours)}` : "nothing due"}`}
      onClick={onSelect}
      className={`flex min-w-0 flex-col items-center rounded-xl px-0.5 pb-2 pt-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${
        selected
          ? "bg-brand-500/10 ring-1 ring-inset ring-brand-500/40"
          : late
            ? "bg-red-500/[0.06] hover:bg-red-500/10"
            : "hover:bg-ink-900/[0.04] dark:hover:bg-white/[0.05]"
      }`}
    >
      <span
        className={`text-[10px] font-semibold uppercase tracking-wider ${
          late ? "text-red-500" : weekend ? "text-ink-400/70 dark:text-ink-500" : "text-ink-400"
        }`}
        aria-hidden="true"
      >
        {late ? "Late" : column.date.toLocaleDateString([], { weekday: "short" })}
      </span>
      <span
        className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${
          late
            ? "bg-red-500 text-white"
            : isToday
              ? "brand-mark text-white shadow-glow-sm"
              : "text-ink-800 dark:text-ink-100"
        }`}
        aria-hidden="true"
      >
        {late ? <AlarmClock className="h-3.5 w-3.5" /> : column.date.getDate()}
      </span>

      <span
        className={`mt-3 flex h-28 w-full max-w-[2.5rem] flex-col-reverse overflow-hidden rounded-lg bg-ink-900/[0.05] dark:bg-white/[0.06] ${
          over ? "ring-2 ring-accent-500/80" : ""
        }`}
        aria-hidden="true"
      >
        {column.items.map((item, i) => (
          <span
            key={item.taskId}
            className={`w-full shrink-0 origin-bottom border-t border-white/80 first:border-t-0 dark:border-ink-900/70 motion-safe:animate-rise ${TIER_FILL[item.tier] || TIER_FILL.TIER_3} ${
              item.isSnoozed ? "opacity-40" : ""
            }`}
            style={{ height: `${(item.hours / scale) * 100}%`, minHeight: 4, animationDelay: `${60 + i * 60}ms` }}
          />
        ))}
      </span>

      <span
        className={`mt-2 text-xs font-semibold tabular-nums ${over ? "text-accent-600 dark:text-accent-400" : "text-ink-700 dark:text-ink-200"} ${
          column.items.length ? "" : "invisible"
        }`}
        aria-hidden="true"
      >
        {formatHours(column.hours || 0)}
      </span>
      <span className="text-[10px] text-ink-400" aria-hidden="true">
        {column.items.length ? taskCount(column.items.length) : "clear"}
      </span>
    </button>
  );
}

// The Week lens: seven days at a glance, then every task due in them ranked
// against the whole week rather than just its own day.
export default function PlanWeek({ items, capacity, statusesByWorkspace, onStatusChange, onTogglePin, onToggleSnooze, onTaskClick }) {
  const [page, setPage] = useState(0);
  const [selectedKey, setSelectedKey] = useState(null);
  const week = useMemo(() => buildWeek(items, page), [items, page]);

  const columns = week.overdue.items.length ? [week.overdue, ...week.days] : week.days;
  const selected = columns.find((c) => c.key === selectedKey);
  const busiest = week.days.reduce((best, d) => (d.hours > (best?.hours || 0) ? d : best), null);

  const go = (next) => {
    setPage(next);
    setSelectedKey(null);
  };

  const rowProps = (item) => {
    const rank = week.rankById.get(item.taskId);
    const when = whenLabel(item);
    return {
      item,
      rank,
      highlight: rank <= TOP_OF_WEEK,
      when,
      whenTone: when.startsWith("Overdue") ? "danger" : undefined,
      statuses: statusesByWorkspace?.[item.workspaceId],
      onStatusChange,
      onTogglePin,
      onToggleSnooze,
      onTaskClick,
    };
  };

  const top = week.ranked.slice(0, TOP_OF_WEEK);
  const rest = week.ranked.slice(TOP_OF_WEEK);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-label">{pageCaption(page)}</p>
          <h3 className="mt-0.5 text-lg font-semibold text-ink-900 dark:text-ink-50">{rangeLabel(week.start, week.end)}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className="btn-secondary !px-3 !py-1.5" disabled={page === 0} onClick={() => go(page - 1)}>
            Previous
          </button>
          {page > 0 && (
            <button type="button" className="btn-ghost !px-3 !py-1.5" onClick={() => go(0)}>
              Today
            </button>
          )}
          <button type="button" className="btn-secondary !px-3 !py-1.5" onClick={() => go(page + 1)}>
            Next
          </button>
        </div>
      </div>

      <section className="card p-3 sm:p-4" aria-label="Week at a glance">
        {/* A column needs ~2.5rem to keep its date legible; on a narrow phone
            the chart scrolls sideways rather than crushing the dates. */}
        <div className="overflow-x-auto">
          <div
            role="group"
            aria-label="Pick a day to focus the ranking on it"
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
              minWidth: `${columns.length * 2.5}rem`,
            }}
          >
            {columns.map((column) => (
              <DayColumn
                key={column.key}
                column={column}
                capacity={capacity}
                selected={column.key === selectedKey}
                onSelect={() => setSelectedKey(column.key === selectedKey ? null : column.key)}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-ink-900/[0.07] px-1 pt-3 text-[11px] dark:border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-ink-500 dark:text-ink-400">
            {Object.entries(TIER_META).map(([tier, meta]) => (
              <span key={tier} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-[3px] ${TIER_FILL[tier]}`} /> {meta.short} {meta.description.split(" / ")[0]}
              </span>
            ))}
          </div>
          <p className="font-medium text-ink-600 dark:text-ink-300">
            {week.ranked.length
              ? `${formatHours(week.hours)} across ${taskCount(week.ranked.length)}`
              : "Nothing due"}
            {busiest && (
              <span className="text-ink-400">
                {" "}
                · busiest {busiest.offset === 0 ? "today" : shortDay(busiest.date)}
              </span>
            )}
          </p>
        </div>
      </section>

      <section className="card p-3 sm:p-4" aria-label="Week priority">
        <header className="flex flex-wrap items-end justify-between gap-2 px-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-ink-900 dark:text-ink-50">
              {selected ? (selected.key === "overdue" ? "Overdue" : selected.date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })) : "Week priority"}
            </h3>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              {selected
                ? "Just this day, each task keeping its rank in the whole week"
                : "Every task in these 7 days, ranked against each other"}
            </p>
          </div>
          {selected && (
            <button type="button" className="btn-ghost !px-3 !py-1 text-xs" onClick={() => setSelectedKey(null)}>
              Show whole week
            </button>
          )}
        </header>

        {week.ranked.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<CalendarRange className="h-5 w-5" />}
              title="Nothing due these 7 days"
              description="Tasks with a due date in this window get ranked here against the rest of the week."
            />
          </div>
        ) : selected ? (
          selected.items.length ? (
            <div className="mt-3 space-y-0.5">
              {selected.items.map((item) => (
                <PlanTaskRow key={item.taskId} {...rowProps(item)} />
              ))}
            </div>
          ) : (
            <p className="px-2 pb-1 pt-3 text-sm text-ink-500 dark:text-ink-400">Nothing due this day.</p>
          )
        ) : (
          <>
            <p className="section-label mb-1 mt-4 px-2">Top of the week</p>
            <div className="space-y-0.5">
              {top.map((item) => (
                <PlanTaskRow key={item.taskId} {...rowProps(item)} />
              ))}
            </div>
            {rest.length > 0 && (
              <>
                <p className="section-label mb-1 mt-4 px-2">Then</p>
                <div className="space-y-0.5">
                  {rest.map((item) => (
                    <PlanTaskRow key={item.taskId} {...rowProps(item)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

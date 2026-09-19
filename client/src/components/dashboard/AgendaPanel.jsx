import { Link } from "react-router-dom";
import { CalendarRange } from "lucide-react";
import { TierBadge } from "../common/Badges.jsx";
import { displayColor } from "../../lib/colors.js";
import { dayName } from "./fortnight.js";

// Rows shown when no day is picked; the rest are summarised in the footer.
const ALL_DAYS_LIMIT = 8;

function formatDuration(start, end) {
  const minutes = Math.round((new Date(end) - new Date(start)) / 60000);
  if (!minutes || minutes < 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
}

function agendaItems(day) {
  return [
    ...day.deadlines.map((t) => ({ kind: "task", at: t.dueDate, item: t })),
    ...day.meetings.map((e) => ({ kind: "meeting", at: e.startTime, item: e })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
}

function AgendaRow({ entry, colorFor }) {
  const { kind, item } = entry;
  const isTask = kind === "task";
  const duration = isTask ? null : formatDuration(item.startTime, item.endTime);

  return (
    <Link
      to={`/workspaces/${item.workspaceId}/${isTask ? "tasks" : "calendar"}`}
      className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-brand-500/[0.07] sm:gap-3"
    >
      <span className="w-[3.75rem] shrink-0 text-xs font-medium tabular-nums text-ink-500 dark:text-ink-400 sm:w-[4.25rem]">
        {isTask ? "Due" : new Date(item.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </span>
      <span
        className={`w-1 shrink-0 rounded-full ${isTask ? "h-4" : "h-8"}`}
        style={{ backgroundColor: displayColor(colorFor(item)) }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-800 group-hover:text-brand-700 dark:text-ink-100 dark:group-hover:text-brand-300">
          {item.title}
        </p>
        <p className="truncate text-xs text-ink-500 dark:text-ink-400">
          {item.workspaceName}
          {duration && ` · ${duration}`}
        </p>
      </div>
      {isTask && <TierBadge tier={item.tier} compact />}
    </Link>
  );
}

export default function AgendaPanel({ days, selectedKey, onShowAll, colorFor, className = "" }) {
  const selected = selectedKey ? days.find((d) => d.key === selectedKey) : null;

  let groups = (selected ? [selected] : days)
    .map((day) => ({ day, items: agendaItems(day) }))
    .filter((g) => g.items.length > 0);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  // Trim to the row budget without splitting the reader's sense of "which
  // day": a group is cut short, never dropped mid-list.
  let hidden = 0;
  if (!selected && total > ALL_DAYS_LIMIT) {
    let budget = ALL_DAYS_LIMIT;
    groups = groups
      .map((g) => {
        const items = g.items.slice(0, Math.max(budget, 0));
        budget -= items.length;
        return { ...g, items };
      })
      .filter((g) => g.items.length > 0);
    hidden = total - ALL_DAYS_LIMIT;
  }

  const title = selected
    ? selected.date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    : "Coming up";
  const subtitle = selected
    ? total
      ? `${total} item${total === 1 ? "" : "s"} on this day`
      : "Nothing on this day"
    : "Meetings and deadlines for the next 14 days";

  return (
    <section className={`card flex h-full flex-col p-5 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">{title}</h3>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{subtitle}</p>
        </div>
        {selected && (
          <button
            type="button"
            onClick={onShowAll}
            className="shrink-0 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
          >
            Show all days
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-1 items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-300/60 px-4 py-6 dark:border-white/10">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
            <CalendarRange className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink-700 dark:text-ink-200">
              {selected ? `${dayName(selected)} is open` : "Your next two weeks are open"}
            </p>
            <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
              Meetings and tasks due in any of your workspaces line up here by day.
            </p>
          </div>
        </div>
      ) : (
        // Scrolls inside the card when the dashboard gives it a fixed height.
        <div className="-mx-2 min-h-0 flex-1 space-y-3 overflow-y-auto px-2">
          {groups.map(({ day, items }) => (
            <div key={day.key}>
              {!selected && (
                <p className="mb-0.5 flex items-baseline gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                  {day.index < 2 ? dayName(day) : day.date.toLocaleDateString([], { weekday: "long" })}
                  <span className="font-medium normal-case tracking-normal text-ink-400 dark:text-ink-500">
                    {day.date.toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                  {day.clash && (
                    <span className="badge bg-accent-100 text-[10px] normal-case tracking-normal text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
                      Clash
                    </span>
                  )}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((entry) => (
                  <AgendaRow key={`${entry.kind}-${entry.item.id}`} entry={entry} colorFor={colorFor} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hidden > 0 && (
        <p className="mt-3 border-t border-ink-900/[0.06] px-2 pt-3 text-xs text-ink-500 dark:border-white/[0.06] dark:text-ink-400">
          {hidden} more in the next two weeks.{" "}
          <Link to="/plan" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
            Open my plan
          </Link>
        </p>
      )}
    </section>
  );
}

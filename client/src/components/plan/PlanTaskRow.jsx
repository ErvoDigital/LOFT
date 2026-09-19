import { Pin, Moon } from "lucide-react";
import { TierBadge } from "../common/Badges.jsx";
import { displayColor } from "../../lib/colors.js";
import Select from "../common/Select.jsx";
import { formatHours } from "./planModel.js";

// The rank numeral leading a row. The group's top pick(s) take the brand
// fill so the eye lands there first; the rest stay quiet.
function RankMark({ rank, highlight }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums ${
        highlight
          ? "brand-mark text-white shadow-glow-sm"
          : "bg-ink-900/[0.05] text-ink-500 dark:bg-white/[0.06] dark:text-ink-400"
      }`}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

// `when` is the date phrase the surrounding view wants shown — a day lane
// already names its date, so it passes none; the week list passes the day.
export default function PlanTaskRow({
  item,
  rank,
  highlight = false,
  when,
  whenTone,
  statuses,
  onStatusChange,
  onTogglePin,
  onToggleSnooze,
  onTaskClick,
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-xl px-2 py-2 transition-colors hover:bg-ink-900/[0.04] dark:hover:bg-white/[0.04] ${
        item.isSnoozed ? "opacity-60" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-2.5">
        {rank != null && <RankMark rank={rank} highlight={highlight} />}
        <div className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: displayColor(item.workspaceColor) }} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onTaskClick(item)}
            className="block w-full truncate text-left text-sm font-medium text-ink-800 hover:text-brand-700 dark:text-ink-100 dark:hover:text-brand-300"
          >
            {item.title}
          </button>
          <p className="truncate text-xs text-ink-400">
            {item.workspaceName}
            {when && <span className={whenTone === "danger" ? "text-red-500" : ""}> · {when}</span>}
            {item.atRisk && <span className="text-red-500"> · at risk</span>}
            {item.isPinned && <span className="text-brand-600 dark:text-brand-300"> · pinned</span>}
            {item.isSnoozed && <span> · snoozed</span>}
          </p>
        </div>
      </div>

      {/* Shrinkable as a group: on a phone this wraps under the title, where
          a wide status label would otherwise push the row off the card. */}
      <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
        <span className="shrink-0 text-xs font-medium tabular-nums text-ink-400">{formatHours(item.hours)}</span>
        <span className="shrink-0">
          <TierBadge tier={item.tier} compact />
        </span>
        {statuses && statuses.length > 0 ? (
          <Select
            size="sm"
            align="end"
            aria-label={`Status of ${item.title}`}
            className="min-w-0 max-w-[9.5rem]"
            value={item.status}
            onChange={(next) => onStatusChange(item, next)}
            options={statuses.map((s) => ({
              value: s.id,
              label: s.label,
              icon: <span className="h-2 w-2 rounded-full" style={{ backgroundColor: displayColor(s.color) }} />,
            }))}
          />
        ) : (
          <span className="shrink-0 text-xs font-medium text-ink-400">{item.status}</span>
        )}
        <button
          type="button"
          onClick={() => onTogglePin(item)}
          title={item.isPinned ? "Unpin" : "Pin to top"}
          aria-pressed={!!item.isPinned}
          className={`shrink-0 rounded-md border p-1.5 transition-colors ${
            item.isPinned
              ? "border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
              : "border-ink-200 text-ink-400 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-700"
          }`}
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onToggleSnooze(item)}
          title={item.isSnoozed ? "Unsnooze" : "Snooze"}
          aria-pressed={!!item.isSnoozed}
          className={`shrink-0 rounded-md border p-1.5 transition-colors ${
            item.isSnoozed
              ? "border-ink-400 bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-300"
              : "border-ink-200 text-ink-400 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-700"
          }`}
        >
          <Moon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

import { TIER_META } from "../common/Badges.jsx";
import { formatHours, whenLabel } from "./planModel.js";

const INTRO = {
  overdue: "Overdue, so this comes first",
  today: "Up first today",
  next: "Nothing due today. Next up",
  undated: "Nothing on the calendar. Top of your open list",
};

// "due today", "due Tue 22", or "Overdue · Sep 17".
function duePhrase(item) {
  const when = whenLabel(item);
  if (when.startsWith("Overdue")) return when;
  return `due ${when === "Today" || when === "Tomorrow" ? when.toLowerCase() : when}`;
}

// Today's due hours against the daily hours setting. White on the brand
// gradient; amber once the day is overbooked. From `sm` up it's a large ring
// beside the focus task; on phones it's a small ring in a footer row, with
// the figures spelled out beside it, so it doesn't sit alone under the text.
function LoadRing({ hours, capacity }) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const ratio = Math.min(1, hours / capacity);
  const over = hours > capacity;

  return (
    <div className="flex items-center gap-3.5 border-t border-white/10 pt-4 sm:block sm:border-0 sm:pt-0">
      <div className="relative h-14 w-14 shrink-0 sm:h-32 sm:w-32" role="img" aria-label={`${formatHours(hours)} due today of ${capacity}h`}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-white/15" />
          {ratio > 0 && (
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ratio)}
              className={`transition-[stroke-dashoffset] duration-700 ${over ? "stroke-accent-400" : "stroke-white"}`}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" aria-hidden="true">
          <span className="text-sm font-semibold leading-none tabular-nums sm:text-[1.75rem]">{formatHours(hours)}</span>
          <span className={`mt-1 hidden text-[10px] font-semibold uppercase tracking-wider sm:block ${over ? "text-accent-300" : "text-brand-100"}`}>
            {over ? `over ${capacity}h today` : `of ${capacity}h today`}
          </span>
        </div>
      </div>
      <div className="min-w-0 sm:hidden" aria-hidden="true">
        <p className="text-sm font-semibold text-white">
          {formatHours(hours)} of {capacity}h booked today
        </p>
        <p className={`mt-0.5 text-xs ${over ? "text-accent-300" : "text-brand-100"}`}>
          {over ? `${formatHours(hours - capacity)} over your daily hours` : `${formatHours(capacity - hours)} still free`}
        </p>
      </div>
    </div>
  );
}

// A tile on phones, four to a row: the figure with its dot, and the label
// under them with the tile's full width to itself. From `sm` up it's the
// inline pill: the figure row dissolves (display: contents) and `order` lines
// dot, figure and label up in one row.
function Stat({ value, label, dot }) {
  return (
    <span className="flex min-w-0 flex-col gap-1.5 rounded-xl bg-white/10 px-2.5 py-2 text-white ring-1 ring-inset ring-white/15 sm:inline-flex sm:flex-row sm:items-center sm:gap-2 sm:rounded-full sm:px-3 sm:py-1 sm:text-xs sm:font-medium">
      <span className="flex items-center justify-between gap-1.5 sm:contents">
        <span className="text-lg font-semibold leading-none tabular-nums sm:order-2 sm:text-xs">{value}</span>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full sm:order-1 ${dot}`} />
      </span>
      <span className="truncate text-[11px] font-medium leading-none text-brand-100 sm:order-3 sm:text-xs sm:text-white">{label}</span>
    </span>
  );
}

// My Plan's lead: the single task Smart Priority says to start with, how full
// today already is, and the four counts that used to be separate tiles.
export default function PlanFocusHero({ focus, todayHours, capacity, stats, onOpen }) {
  const item = focus?.item;
  const tier = item && (TIER_META[item.tier] || TIER_META.TIER_3);

  return (
    <section className="hero-panel p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-100">
            {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </p>

          {item ? (
            <>
              <p className="mt-4 text-sm font-medium text-brand-100">{INTRO[focus.reason]}</p>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="mt-1 block max-w-full text-balance text-left text-2xl font-semibold leading-tight tracking-tight text-white decoration-white/40 underline-offset-4 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden hover:underline focus-visible:underline focus-visible:outline-none sm:text-[2rem]"
              >
                {item.title}
              </button>
              <p className="mt-2 text-sm text-brand-100">
                {item.workspaceName}
                <span className="text-brand-100/60"> · </span>
                {tier.label} priority
                <span className="text-brand-100/60"> · </span>
                {formatHours(item.hours)}
                {item.dueDate && (
                  <>
                    <span className="text-brand-100/60"> · </span>
                    {duePhrase(item)}
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">A clear plate</h3>
              <p className="mt-2 text-sm text-brand-100">Everything open is snoozed. Wake a task to put it back in the plan.</p>
            </>
          )}

          <div className="mt-5 grid grid-cols-2 gap-1.5 min-[360px]:grid-cols-4 sm:flex sm:flex-wrap sm:gap-2">
            <Stat value={stats.open} label="open" dot="bg-brand-300" />
            <Stat value={stats.urgent} label="urgent" dot={stats.urgent ? "bg-red-400" : "bg-white/40"} />
            <Stat value={stats.overdue} label="overdue" dot={stats.overdue ? "bg-red-400" : "bg-white/40"} />
            <Stat value={stats.atRisk} label="at risk" dot={stats.atRisk ? "bg-accent-400" : "bg-white/40"} />
          </div>
        </div>

        <LoadRing hours={todayHours} capacity={capacity} />
      </div>
    </section>
  );
}

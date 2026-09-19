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
// gradient; amber once the day is overbooked.
function LoadRing({ hours, capacity }) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const ratio = Math.min(1, hours / capacity);
  const over = hours > capacity;

  return (
    <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32" role="img" aria-label={`${formatHours(hours)} due today of ${capacity}h`}>
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
        <span className="text-2xl font-semibold leading-none tabular-nums sm:text-[1.75rem]">{formatHours(hours)}</span>
        <span className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${over ? "text-accent-300" : "text-brand-100"}`}>
          {over ? `over ${capacity}h today` : `of ${capacity}h today`}
        </span>
      </div>
    </div>
  );
}

function Stat({ value, label, dot }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/15">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="font-semibold tabular-nums">{value}</span> {label}
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
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
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
                {tier.label}, {tier.description.toLowerCase()}
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

          <div className="mt-5 flex flex-wrap gap-2">
            <Stat value={stats.open} label="open" dot="bg-brand-300" />
            <Stat value={stats.critical} label="critical" dot={stats.critical ? "bg-red-400" : "bg-white/40"} />
            <Stat value={stats.overdue} label="overdue" dot={stats.overdue ? "bg-red-400" : "bg-white/40"} />
            <Stat value={stats.atRisk} label="at risk" dot={stats.atRisk ? "bg-accent-400" : "bg-white/40"} />
          </div>
        </div>

        <LoadRing hours={todayHours} capacity={capacity} />
      </div>
    </section>
  );
}

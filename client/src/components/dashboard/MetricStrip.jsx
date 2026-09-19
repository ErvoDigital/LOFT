import { Link } from "react-router-dom";

const TONES = {
  default: {
    value: "text-ink-900 dark:text-ink-50",
    icon: "bg-brand-500/10 text-brand-600 dark:text-brand-300",
  },
  danger: {
    value: "text-red-600 dark:text-red-400",
    icon: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

// Cell dividers for a 2×2 grid that becomes a single row once the strip
// itself is 42rem wide. Keyed to the strip's width, not the screen's, because
// users can resize it on the dashboard.
const CELL_BORDERS = ["", "border-l", "border-t @2xl:border-l @2xl:border-t-0", "border-l border-t @2xl:border-t-0"];

// One glass strip split into cells, rather than four floating tiles — the
// numbers read as a single "right now" summary. Each carries a plain-language
// detail line naming the specific thing behind the count, and a cell with a
// `to` opens the view where that thing lives.
export default function MetricStrip({ metrics, className = "" }) {
  return (
    <div className={`@container ${className}`}>
      <div className="card grid grid-cols-2 overflow-hidden @2xl:grid-cols-4">
        {metrics.map((m, i) => {
          const tone = TONES[m.tone] || TONES.default;
          const Icon = m.icon;
          const cell = `min-w-0 border-ink-900/[0.07] p-4 dark:border-white/[0.06] sm:p-5 ${CELL_BORDERS[i] || ""}`;
          const body = (
            <>
              <p className="flex items-center gap-2 text-xs font-medium text-ink-600 dark:text-ink-300">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="truncate">{m.label}</span>
              </p>
              <p className={`mt-3 text-3xl font-semibold tracking-tight ${tone.value}`}>{m.value}</p>
              <p className="mt-1 truncate text-xs text-ink-500 dark:text-ink-400" title={m.detail}>
                {m.detail}
              </p>
            </>
          );

          return m.to ? (
            <Link
              key={m.label}
              to={m.to}
              className={`${cell} group transition-colors hover:bg-brand-500/[0.06] focus-visible:bg-brand-500/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500`}
            >
              {body}
            </Link>
          ) : (
            <div key={m.label} className={cell}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

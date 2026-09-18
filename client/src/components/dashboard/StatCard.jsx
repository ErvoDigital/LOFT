// Trend is shown as a colored dot plus text rather than an up/down arrow —
// the design system has no arrow glyphs.
const TONES = {
  default: { value: "text-ink-900 dark:text-ink-50", dot: "bg-ink-300 dark:bg-ink-600" },
  brand: { value: "text-brand-600 dark:text-brand-300", dot: "bg-brand-500" },
  danger: { value: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  positive: { value: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
};

export default function StatCard({ label, value, trend, tone = "default" }) {
  const t = TONES[tone] || TONES.default;

  return (
    <div className="stat-card">
      {/* Signature blue wash, strongest at the top-left corner of the tile. */}
      <div
        className="pointer-events-none absolute -right-6 -top-10 h-24 w-24 rounded-full bg-brand-500/10 blur-2xl"
        aria-hidden="true"
      />
      <p className={`stat-value ${t.value}`}>{value}</p>
      <p className="stat-label">{label}</p>
      {trend && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-ink-400 dark:text-ink-500">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />
          {trend}
        </p>
      )}
    </div>
  );
}

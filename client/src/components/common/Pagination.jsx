// Previous, page numbers, Next. Worded rather than arrowed, like every other
// control in LOFT. Long runs keep the first and last page and the ones either
// side of the current page, so the control stays seven slots wide; phones get
// "2 of 5" in place of the numbers.
function pageList(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const start = Math.max(2, Math.min(page - 1, count - 4));
  const end = Math.min(count - 1, Math.max(page + 1, 5));
  const list = [1];
  if (start > 2) list.push("gap-start");
  for (let p = start; p <= end; p++) list.push(p);
  if (end < count - 1) list.push("gap-end");
  list.push(count);
  return list;
}

const STEP = "btn-ghost px-2.5 py-1.5 text-xs";

// page is 1-based.
export default function Pagination({ page, pageCount, onChange, label = "Pages", className = "" }) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label={label} className={`flex items-center gap-1 ${className}`}>
      <button type="button" className={STEP} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <div className="hidden items-center gap-1 sm:flex">
        {pageList(page, pageCount).map((p) =>
          typeof p === "number" ? (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onChange(p)}
              className={`h-8 min-w-8 rounded-lg px-2 text-xs font-medium tabular-nums transition-colors ${
                p === page
                  ? "brand-mark text-white shadow-glow-sm"
                  : "text-ink-600 hover:bg-ink-900/[0.06] hover:text-ink-900 dark:text-ink-300 dark:hover:bg-white/[0.08] dark:hover:text-ink-50"
              }`}
            >
              {p}
            </button>
          ) : (
            <span key={p} className="w-5 text-center text-xs text-ink-400 dark:text-ink-500" aria-hidden="true">
              …
            </span>
          )
        )}
      </div>
      <span className="px-1 text-xs tabular-nums text-ink-500 dark:text-ink-400 sm:hidden" aria-live="polite">
        {page} of {pageCount}
      </span>
      <button type="button" className={STEP} disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}

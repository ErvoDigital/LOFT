import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import Pagination from "../common/Pagination.jsx";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";
import useMediaQuery from "../../hooks/useMediaQuery.js";
import { displayColor } from "../../lib/colors.js";
import { dayKey, startOfDay } from "./fortnight.js";

// Clashes per page. Past this the list pages instead of growing, so a busy
// fortnight can't push the rest of the dashboard out of sight.
const PAGE_SIZE = 10;
// On a phone each clash still takes a few lines, so phones show this many
// first and page only once the reader asks for the rest.
const PHONE_PREVIEW = 3;

// Worded apart from task priority (Urgent/High/Medium/Low), which a clash
// row sits right next to elsewhere in the app.
const SEVERITY = {
  high: { label: "Serious", dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  medium: { label: "Moderate", dot: "bg-accent-500", text: "text-accent-700 dark:text-accent-400" },
  low: { label: "Minor", dot: "bg-ink-400", text: "text-ink-500 dark:text-ink-400" },
};
const SEVERITY_ORDER = ["high", "medium", "low"];
const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

// What collided, in a few words. The server's sentence repeats every title
// and workspace, which the row already shows; it's kept for screen readers.
const TYPE_LABEL = {
  EVENT_OVERLAP: "Meetings overlap",
  DEADLINE_CLASH: "Due the same day",
  TASK_EVENT_SAME_DAY: "Due on a meeting day",
};

const clashKey = (c) => `${c.type}:${c.items.map((i) => `${i.kind}-${i.id}`).join(":")}`;
const clashTime = (c) => Math.min(...c.items.map((i) => new Date(i.time).getTime()));

function dayHeading(time) {
  const date = new Date(time);
  const diff = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
  const name =
    diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : date.toLocaleDateString([], { weekday: "long" });
  return { name, date: date.toLocaleDateString([], { month: "short", day: "numeric" }) };
}

function ClashItem({ item, color }) {
  const isTask = item.kind === "task";
  return (
    <Link
      to={`/workspaces/${item.workspaceId}/${isTask ? "tasks" : "calendar"}`}
      title={`${item.title} · ${item.workspaceName}`}
      className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-ink-900/[0.06] bg-white/60 px-3 py-1.5 transition-colors hover:border-brand-400/50 hover:bg-white dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-brand-400/30 dark:hover:bg-white/[0.06]"
    >
      <span
        className="h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: displayColor(color) }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-800 group-hover:text-brand-700 dark:text-ink-100 dark:group-hover:text-brand-300">
          {item.title}
        </p>
        <p className="truncate text-xs text-ink-500 dark:text-ink-400">{item.workspaceName}</p>
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums text-ink-500 dark:text-ink-400">
        {isTask ? "Due" : new Date(item.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </span>
    </Link>
  );
}

function ClashRow({ clash, colorFor }) {
  const severity = SEVERITY[clash.severity] || SEVERITY.low;
  return (
    <li className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 @2xl:flex-row @2xl:items-center @2xl:gap-4">
      <div className="flex items-center gap-2 @2xl:w-44 @2xl:shrink-0 @2xl:items-start">
        <span className={`h-2 w-2 shrink-0 rounded-full @2xl:mt-1.5 ${severity.dot}`} aria-hidden="true" />
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 @2xl:flex-col @2xl:gap-0.5">
          <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{TYPE_LABEL[clash.type] || "Clash"}</p>
          <p className={`text-xs font-medium ${severity.text}`}>{severity.label}</p>
        </div>
      </div>
      <p className="sr-only">{clash.message}</p>
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 @3xl:grid-cols-2">
        {clash.items.map((item) => (
          <ClashItem key={`${item.kind}-${item.id}`} item={item} color={colorFor(item.workspaceId)} />
        ))}
      </div>
    </li>
  );
}

function SeverityFilter({ counts, total, value, onChange }) {
  const options = [
    { id: "all", label: "All", count: total },
    ...SEVERITY_ORDER.filter((s) => counts[s]).map((s) => ({ id: s, label: SEVERITY[s].label, count: counts[s] })),
  ];
  // In a narrow panel the four labels don't fit on one line, so each count
  // drops under its label and the control spans the panel.
  return (
    <div
      className="grid w-full auto-cols-fr grid-flow-col gap-1 rounded-xl bg-ink-900/[0.05] p-1 text-xs dark:bg-white/[0.05] @md:flex @md:w-auto"
      role="group"
      aria-label="Filter clashes"
    >
      {options.map(({ id, label, count }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={`flex flex-col items-center whitespace-nowrap rounded-lg px-1.5 py-1 font-medium transition-colors @md:flex-row @md:gap-1.5 @md:px-2.5 ${
            value === id
              ? "bg-white text-ink-800 shadow-soft dark:bg-ink-800 dark:text-ink-100"
              : "text-ink-500 hover:text-ink-800 dark:hover:text-ink-200"
          }`}
        >
          {id !== "all" && (
            <span className={`hidden h-1.5 w-1.5 rounded-full @md:inline-block ${SEVERITY[id].dot}`} aria-hidden="true" />
          )}
          {label}
          <span className="tabular-nums text-ink-400 dark:text-ink-500">{count}</span>
        </button>
      ))}
    </div>
  );
}

export default function ConflictsPanel({ conflicts, title = "Clashes across workspaces", id, className = "" }) {
  const phone = useMediaQuery("(max-width: 639px)");
  const { workspaces } = useWorkspaces();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef(null);

  // Soonest first, so the list reads like a calendar; the worst clash leads
  // within a day.
  const sorted = useMemo(
    () =>
      (conflicts || [])
        .map((c) => ({ ...c, at: clashTime(c) }))
        .sort(
          (a, b) =>
            startOfDay(a.at) - startOfDay(b.at) ||
            (SEVERITY_RANK[a.severity] ?? 2) - (SEVERITY_RANK[b.severity] ?? 2) ||
            a.at - b.at
        ),
    [conflicts]
  );

  const colorById = useMemo(() => new Map(workspaces.map((w) => [w.id, w.color])), [workspaces]);
  const colorFor = (workspaceId) => colorById.get(workspaceId);

  if (sorted.length === 0) {
    return (
      <div className="card flex items-center gap-3 border-brand-200 bg-brand-50 p-4 dark:bg-brand-500/15">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
        <div>
          <p className="text-sm font-medium text-brand-800 dark:text-brand-300">No conflicts across your workspaces</p>
          <p className="text-xs text-brand-700/80 dark:text-brand-300/80">LOFT is watching every deadline and meeting for overlaps — you're clear for the next two weeks.</p>
        </div>
      </div>
    );
  }

  const counts = sorted.reduce((m, c) => ({ ...m, [c.severity]: (m[c.severity] || 0) + 1 }), {});
  // A reload can empty the picked severity; fall back to everything then.
  const active = filter !== "all" && counts[filter] ? filter : "all";
  const filtered = active === "all" ? sorted : sorted.filter((c) => c.severity === active);

  const collapsed = phone && !expanded && filtered.length > PHONE_PREVIEW;
  const pageCount = collapsed ? 1 : Math.ceil(filtered.length / PAGE_SIZE);
  const current = Math.min(page, pageCount);
  const first = (current - 1) * PAGE_SIZE;
  const shown = collapsed ? filtered.slice(0, PHONE_PREVIEW) : filtered.slice(first, first + PAGE_SIZE);

  const perDay = filtered.reduce((m, c) => m.set(dayKey(c.at), (m.get(dayKey(c.at)) || 0) + 1), new Map());
  const days = [];
  for (const c of shown) {
    const key = dayKey(c.at);
    if (days.at(-1)?.key !== key) days.push({ key, at: c.at, clashes: [] });
    days.at(-1).clashes.push(c);
  }

  const pickFilter = (value) => {
    setFilter(value);
    setPage(1);
  };

  // Next sits at the foot of the list, so the new page's first rows can be
  // off the top of the screen. Bring the panel's top back into view if so.
  const goToPage = (p) => {
    setPage(p);
    const panel = panelRef.current;
    if (!panel) return;
    const scroller = panel.closest("main");
    const top = scroller ? scroller.getBoundingClientRect().top : 0;
    if (panel.getBoundingClientRect().top < top) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      panel.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  const total = sorted.length;
  const subtitle =
    active === "all"
      ? `${total} ${total === 1 ? "clash" : "clashes"} to resolve, soonest first`
      : `${filtered.length} ${SEVERITY[active].label.toLowerCase()} of ${total} to resolve`;

  return (
    <section ref={panelRef} id={id} className={`card scroll-mt-6 p-4 @container sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">{title}</h3>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{subtitle}</p>
        </div>
        {Object.keys(counts).length > 1 && (
          <SeverityFilter counts={counts} total={total} value={active} onChange={pickFilter} />
        )}
      </div>

      <div className="mt-4 space-y-4">
        {days.map((day) => {
          const heading = dayHeading(day.at);
          const count = perDay.get(day.key);
          return (
            <div key={day.key}>
              <p className="mb-2 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                {heading.name}
                <span className="font-medium normal-case tracking-normal text-ink-400 dark:text-ink-500">{heading.date}</span>
                <span className="ml-auto font-medium normal-case tracking-normal text-ink-400 dark:text-ink-500">
                  {count} {count === 1 ? "clash" : "clashes"}
                </span>
              </p>
              <ul className="divide-y divide-ink-900/[0.06] dark:divide-white/[0.06]">
                {day.clashes.map((c) => (
                  <ClashRow key={clashKey(c)} clash={c} colorFor={colorFor} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {collapsed ? (
        <button type="button" onClick={() => setExpanded(true)} className="btn-secondary mt-4 w-full">
          Show all {filtered.length} clashes
        </button>
      ) : (
        (pageCount > 1 || (phone && expanded)) && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-ink-900/[0.06] pt-3 dark:border-white/[0.06]">
            {pageCount > 1 && (
              <>
                <p className="text-xs tabular-nums text-ink-500 dark:text-ink-400">
                  {first + 1}–{Math.min(first + PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <Pagination page={current} pageCount={pageCount} onChange={goToPage} label="Clash pages" />
              </>
            )}
            {phone && expanded && (
              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  setPage(1);
                }}
                className="btn-ghost w-full py-1.5 text-xs"
              >
                Show fewer
              </button>
            )}
          </div>
        )
      )}
    </section>
  );
}

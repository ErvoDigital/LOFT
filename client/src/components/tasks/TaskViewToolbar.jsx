import { useId, useState } from "react";
import { Columns3, List, Table2, CalendarDays, Search, X, Filter } from "lucide-react";
import Select from "../common/Select.jsx";
import { TIER_META } from "../common/Badges.jsx";
import { DEFAULT_TASK_FILTERS } from "../../lib/taskViews.js";

const VIEWS = [["board", "Board", Columns3], ["list", "List", List], ["table", "Table", Table2], ["calendar", "Calendar", CalendarDays]];
export const SORT_OPTIONS = [
  { value: "order", label: "Board order" }, { value: "title", label: "Task name" },
  { value: "status", label: "Status" }, { value: "priority", label: "Priority" },
  { value: "assignee", label: "Assignee" }, { value: "dueDate", label: "Due date" }, { value: "estimate", label: "Estimate" },
];

export default function TaskViewToolbar({ view, onViewChange, filters, onFiltersChange, statuses, members, total, visible, sort, onSortChange, groupBy, onGroupChange }) {
  const change = (key, value) => onFiltersChange({ ...filters, [key]: value });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterId = useId();
  const filterCount = Object.entries(filters).filter(([key, value]) => key !== "query" && value !== DEFAULT_TASK_FILTERS[key]).length;
  const filtered = Object.entries(filters).some(([key, value]) => value !== DEFAULT_TASK_FILTERS[key]);
  return (
    <div className="shrink-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Task views" className="inline-flex max-w-full gap-0.5 rounded-xl border border-ink-200 bg-white/70 p-1 dark:border-white/10 dark:bg-white/5">
          {VIEWS.map(([value, label, Icon]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => onViewChange(value)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 max-[360px]:gap-1 max-[360px]:px-2 sm:px-3 sm:text-sm ${view === value ? "bg-white text-brand-700 shadow-soft dark:bg-white/10 dark:text-brand-300" : "text-ink-500 hover:bg-white/60 dark:text-ink-400 dark:hover:bg-white/5"}`}>
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />{label}
          </button>)}
        </div>
        <p role="status" className="text-xs tabular-nums text-ink-400">{visible === total ? `${total} ${total === 1 ? "task" : "tasks"}` : `${visible} of ${total} tasks`}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input type="search" aria-label="Search tasks" placeholder="Search tasks…" value={filters.query} onChange={(e) => change("query", e.target.value)} className="input !rounded-lg !py-1.5 !pl-9 !pr-8 !text-xs" />
          {filters.query && <button type="button" aria-label="Clear task search" onClick={() => change("query", "")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400"><X className="h-3 w-3" /></button>}
        </div>
        <button type="button" aria-expanded={filtersOpen} aria-controls={filterId} onClick={() => setFiltersOpen((open) => !open)} className="btn-secondary !gap-1.5 !px-2.5 !py-1.5 text-xs sm:hidden"><Filter className="h-3.5 w-3.5" />Filters{filterCount ? ` (${filterCount})` : ""}</button>
        <div id={filterId} role="group" aria-label="Task filters" className={`w-full flex-wrap items-center gap-2 sm:w-auto ${filtersOpen ? "flex" : "hidden sm:flex"}`}>
        <Select size="sm" aria-label="Filter by status" value={filters.status} onChange={(value) => change("status", value)} options={[{ value: "all", label: "All statuses" }, ...statuses.map((status) => ({ value: status.id, label: status.label }))]} className="max-w-[10rem]" />
        <Select size="sm" aria-label="Filter by assignee" value={filters.assignee} onChange={(value) => change("assignee", value)} options={[{ value: "all", label: "All assignees" }, { value: "mine", label: "Assigned to me" }, { value: "unassigned", label: "Unassigned" }, ...members.map((member) => ({ value: member.user.id, label: member.user.name }))]} className="max-w-[10rem]" />
        <Select size="sm" aria-label="Filter by priority" value={filters.priority} onChange={(value) => change("priority", value)} options={[{ value: "all", label: "All priorities" }, ...Object.entries(TIER_META).map(([value, meta]) => ({ value, label: meta.label }))]} />
        <Select size="sm" aria-label="Filter by due date" value={filters.due} onChange={(value) => change("due", value)} options={[{ value: "all", label: "Any due date" }, { value: "overdue", label: "Overdue" }, { value: "today", label: "Due today" }, { value: "undated", label: "No due date" }]} />
        </div>
        {filtered && <button type="button" onClick={() => onFiltersChange({ ...DEFAULT_TASK_FILTERS })} className="btn-ghost !px-2 !py-1 text-xs">Clear filters</button>}
      </div>
      {(view === "list" || view === "table") && <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
        <span>Sort by</span><Select size="sm" aria-label="Sort tasks by" value={sort.key} onChange={(key) => onSortChange({ key, direction: "asc" })} options={SORT_OPTIONS} />
        <button type="button" onClick={() => onSortChange({ ...sort, direction: sort.direction === "asc" ? "desc" : "asc" })} aria-label={sort.direction === "asc" ? "Sort descending" : "Sort ascending"} className="btn-ghost !px-2 !py-1 text-xs">{sort.direction === "asc" ? "Ascending ↑" : "Descending ↓"}</button>
        {view === "list" && <><span className="ml-2">Group by</span><Select size="sm" aria-label="Group tasks by" value={groupBy} onChange={onGroupChange} options={[{ value: "status", label: "Status" }, { value: "assignee", label: "Assignee" }, { value: "none", label: "None" }]} /></>}
      </div>}
    </div>
  );
}

import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import WorkspaceMark from "../common/WorkspaceMark.jsx";

const TYPE_LABELS = { school: "School", work: "Work", org: "Organization", church: "Church" };

// Each workspace with what it's asking of the user right now — their open
// tasks and upcoming meetings there — so the list doubles as a triage view.
export default function WorkspaceList({ workspaces, openTasksById, meetingsById, onAdd, className = "" }) {
  return (
    <section className={`card flex h-full flex-col p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">
          Workspaces <span className="ml-1 font-normal text-ink-500 dark:text-ink-400">{workspaces.length}</span>
        </h3>
        <button type="button" onClick={onAdd} className="btn-ghost -my-1 -mr-2 px-2.5 py-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <div className="-mx-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2">
        {workspaces.map((w) => {
          const open = openTasksById.get(w.id) || 0;
          const meetings = meetingsById.get(w.id) || 0;
          const meta = [TYPE_LABELS[w.type], `${w.memberCount} member${w.memberCount === 1 ? "" : "s"}`]
            .filter(Boolean)
            .join(" · ");

          return (
            <Link
              key={w.id}
              to={`/workspaces/${w.id}/dashboard`}
              className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-brand-500/[0.07]"
            >
              <WorkspaceMark name={w.name} color={w.color} logoUrl={w.logoUrl} className="h-9 w-9 rounded-xl text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800 group-hover:text-brand-700 dark:text-ink-100 dark:group-hover:text-brand-300">
                  {w.name}
                </p>
                <p className="truncate text-xs text-ink-500 dark:text-ink-400">{meta}</p>
              </div>
              {(open > 0 || meetings > 0) && (
                <span className="flex shrink-0 flex-col items-end text-[11px] leading-4 text-ink-500 dark:text-ink-400">
                  {open > 0 && <span className="font-medium text-ink-700 dark:text-ink-200">{open} open</span>}
                  {meetings > 0 && <span>{meetings} upcoming</span>}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

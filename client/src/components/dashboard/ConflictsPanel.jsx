import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import EmptyState from "../common/EmptyState.jsx";

const SEVERITY_STYLES = {
  high: { border: "border-red-200", bg: "bg-red-50", dot: "bg-red-500", text: "text-red-700" },
  medium: { border: "border-accent-200", bg: "bg-accent-50", dot: "bg-accent-500", text: "text-accent-700" },
  low: { border: "border-ink-200", bg: "bg-ink-50", dot: "bg-ink-400", text: "text-ink-600" },
};

function ConflictItemLink({ item }) {
  const to =
    item.kind === "task" ? `/workspaces/${item.workspaceId}/tasks` : `/workspaces/${item.workspaceId}/calendar`;
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-xs font-medium text-ink-600 hover:border-ink-300"
    >
      <span className="truncate max-w-[10rem]">{item.title}</span>
      <span className="text-ink-400">· {item.workspaceName}</span>
    </Link>
  );
}

export default function ConflictsPanel({ conflicts }) {
  if (!conflicts || conflicts.length === 0) {
    return (
      <div className="card flex items-center gap-3 border-brand-200 bg-brand-50 p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" />
        <div>
          <p className="text-sm font-medium text-brand-800">No conflicts across your workspaces</p>
          <p className="text-xs text-brand-700/80">LOFT is watching every deadline and meeting for overlaps — you're clear for the next two weeks.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conflicts.map((c, i) => {
        const style = SEVERITY_STYLES[c.severity] || SEVERITY_STYLES.low;
        return (
          <div key={i} className={`card ${style.border} ${style.bg} p-4`}>
            <div className="flex items-start gap-3">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${style.text}`}>{c.message}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.items.map((item, idx) => (
                    <ConflictItemLink key={idx} item={item} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

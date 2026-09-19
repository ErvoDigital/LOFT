import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { TierBadge } from "../common/Badges.jsx";

export default function AtRiskPanel({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="card border-red-200 bg-red-50 p-4 dark:bg-red-500/10">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
        <p className="text-sm font-semibold text-red-800 dark:text-red-400">
          {items.length === 1 ? "1 task won't fit before its due date" : `${items.length} tasks won't fit before their due dates`} at this pace
        </p>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <Link
            key={item.taskId}
            to={`/workspaces/${item.workspaceId}/tasks`}
            className="flex items-center justify-between gap-3 rounded-lg bg-white/60 px-2.5 py-1.5 hover:bg-white dark:bg-ink-800/60 dark:hover:bg-ink-700"
          >
            <div className="flex min-w-0 items-center gap-2">
              <TierBadge tier={item.tier} compact />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-red-900 dark:text-red-300">{item.title}</p>
                <p className="truncate text-xs text-red-700/80 dark:text-red-400/80">
                  {item.workspaceName}
                  {item.dueDate && ` · due ${new Date(item.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}`}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-medium text-red-600 dark:text-red-400">short by {item.shortfallHours}h</span>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-red-700/80 dark:text-red-400/80">Raise your daily hours, shrink their estimated duration, or push their due dates.</p>
    </div>
  );
}

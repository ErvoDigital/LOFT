import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import EmptyState from "../common/EmptyState.jsx";
import { PriorityBadge } from "../common/Badges.jsx";

function formatDue(dueDate) {
  if (!dueDate) return "No due date";
  const d = new Date(dueDate);
  const today = new Date();
  const diffDays = Math.round((new Date(d.toDateString()) - new Date(today.toDateString())) / 86400000);
  if (diffDays < 0) return `Overdue · ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

export default function PendingTasksPanel({ tasks }) {
  if (!tasks || tasks.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="Nothing on your plate"
        description="Tasks assigned to you across every workspace show up here."
      />
    );
  }

  return (
    <div className="space-y-1">
      {tasks.slice(0, 8).map((t) => {
        const overdue = t.dueDate && new Date(t.dueDate) < new Date();
        return (
          <Link
            key={t.id}
            to={`/workspaces/${t.workspaceId}/tasks`}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink-50"
          >
            <div className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: t.workspaceColor || "#4F46E5" }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-800">{t.title}</p>
              <p className="truncate text-xs text-ink-400">{t.workspaceName}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <PriorityBadge priority={t.priority} />
              <span className={`text-xs font-medium ${overdue ? "text-red-500" : "text-ink-400"}`}>{formatDue(t.dueDate)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

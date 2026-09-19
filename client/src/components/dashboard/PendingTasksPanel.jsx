import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import EmptyState from "../common/EmptyState.jsx";
import { TierBadge } from "../common/Badges.jsx";

const VISIBLE = 6;
const TIER_RANK = { TIER_1: 0, TIER_2: 1, TIER_3: 2, TIER_4: 3 };

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

// Importance first, then date: what the tier scheme says to do next, which
// the time-ordered agenda beside it can't show.
function byPriority(a, b) {
  const tier = (TIER_RANK[a.tier] ?? 2) - (TIER_RANK[b.tier] ?? 2);
  if (tier) return tier;
  if (!a.dueDate) return b.dueDate ? 1 : 0;
  if (!b.dueDate) return -1;
  return new Date(a.dueDate) - new Date(b.dueDate);
}

export default function PendingTasksPanel({ tasks }) {
  if (!tasks || tasks.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="Nothing on your plate"
        description="Tasks assigned to you in any workspace show up here."
      />
    );
  }

  const sorted = [...tasks].sort(byPriority);
  const startOfToday = new Date(new Date().toDateString());

  return (
    <div>
      <div className="space-y-0.5">
        {sorted.slice(0, VISIBLE).map((t) => {
          const overdue = t.dueDate && new Date(t.dueDate) < startOfToday;
          return (
            <Link
              key={t.id}
              to={`/workspaces/${t.workspaceId}/tasks`}
              className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-brand-500/[0.07]"
            >
              {/* Wide enough for the Tier 1 badge's pulse dot, so titles align. */}
              <span className="flex w-[3.75rem] shrink-0">
                <TierBadge tier={t.tier} compact />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800 group-hover:text-brand-700 dark:text-ink-100 dark:group-hover:text-brand-300">
                  {t.title}
                </p>
                <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                  {t.workspaceName} ·{" "}
                  <span className={overdue ? "font-medium text-red-600 dark:text-red-400" : ""}>{formatDue(t.dueDate)}</span>
                </p>
              </div>
            </Link>
          );
        })}
      </div>
      {sorted.length > VISIBLE && (
        <p className="mt-3 border-t border-ink-900/[0.06] px-2 pt-3 text-xs text-ink-500 dark:border-white/[0.06] dark:text-ink-400">
          {sorted.length - VISIBLE} more assigned to you.{" "}
          <Link to="/plan" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
            See all in my plan
          </Link>
        </p>
      )}
    </div>
  );
}

import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import EmptyState from "../common/EmptyState.jsx";

function formatWhen(start) {
  const d = new Date(start);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
}

export default function UpcomingEvents({ events }) {
  if (!events || events.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="h-5 w-5" />}
        title="No upcoming meetings"
        description="Events from every workspace will show up here."
      />
    );
  }

  return (
    <div className="space-y-1">
      {events.slice(0, 6).map((e) => (
        <Link
          key={e.id}
          to={`/workspaces/${e.workspaceId}/calendar`}
          className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink-50"
        >
          <div className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: e.workspaceColor || "#4F46E5" }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-800">{e.title}</p>
            <p className="truncate text-xs text-ink-400">{e.workspaceName}</p>
          </div>
          <p className="shrink-0 text-xs font-medium text-ink-500">{formatWhen(e.startTime)}</p>
        </Link>
      ))}
    </div>
  );
}

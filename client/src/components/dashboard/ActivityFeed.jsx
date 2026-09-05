import { Activity } from "lucide-react";
import EmptyState from "../common/EmptyState.jsx";
import Avatar from "../common/Avatar.jsx";

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ActivityFeed({ activity }) {
  if (!activity || activity.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="h-5 w-5" />}
        title="No recent activity"
        description="Messages across your workspaces will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {activity.map((a) => (
        <div key={a.id} className="flex items-start gap-3">
          <Avatar name={a.sender?.name} color={a.sender?.avatarColor} size={28} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-600">
              <span className="font-medium text-ink-800">{a.sender?.name}</span> in{" "}
              <span className="text-ink-500">{a.workspaceName}</span>
            </p>
            <p className="truncate text-sm text-ink-500">{a.content}</p>
          </div>
          <span className="shrink-0 text-xs text-ink-400">{timeAgo(a.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

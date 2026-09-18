import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Video, CalendarClock } from "lucide-react";
import { useMeeting } from "../../context/MeetingContext.jsx";
import { useSocket } from "../../context/SocketContext.jsx";
import Avatar from "../common/Avatar.jsx";

// Reads the same "how many are in the room right now" signal the meeting page
// uses, so the overview can say whether a call is live without joining it.
function usePresenceCount(workspaceId, skip) {
  const { socket } = useSocket();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!socket || skip) return;
    socket.emit("meeting:status", workspaceId, (res) => res && setCount(res.count));
    const onActivity = (payload) => {
      if (payload.workspaceId === workspaceId) setCount(payload.count);
    };
    socket.on("meeting:activity", onActivity);
    return () => socket.off("meeting:activity", onActivity);
  }, [socket, workspaceId, skip]);

  return count;
}

export default function MeetingSummaryPanel({ workspaceId, upcomingEvents, onSchedule }) {
  const { joined, activeWorkspaceId, participants } = useMeeting();
  const inThisCall = joined && activeWorkspaceId === workspaceId;
  const presenceCount = usePresenceCount(workspaceId, inThisCall);

  const meetLink = `${window.location.origin}/workspaces/${workspaceId}/meeting`;
  const now = new Date();
  const nextMeeting = (upcomingEvents || [])
    .filter((e) => e.location === meetLink && new Date(e.endTime) >= now)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0];

  const liveCount = inThisCall ? 1 + Object.keys(participants).length : presenceCount;
  const isLive = liveCount > 0;

  return (
    <div className="space-y-4">
      {isLive ? (
        <div className="rounded-2xl border border-brand-400/40 bg-brand-500/10 p-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">
              Live now · {liveCount} in call
            </p>
          </div>
          {inThisCall && Object.keys(participants).length > 0 && (
            <div className="mt-3 flex items-center gap-1.5">
              {Object.entries(participants)
                .slice(0, 6)
                .map(([id, p]) => (
                  <Avatar key={id} name={p.name} color={p.avatarColor} size={26} />
                ))}
            </div>
          )}
          <Link to={`/workspaces/${workspaceId}/meeting`} className="btn-primary mt-4 w-full">
            <Video className="h-4 w-4" />
            {inThisCall ? "Return to call" : "Join call"}
          </Link>
        </div>
      ) : nextMeeting ? (
        <div className="rounded-2xl border border-white/50 bg-white/40 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <p className="section-label">Next meeting</p>
          <p className="mt-1.5 truncate text-sm font-semibold text-ink-800 dark:text-ink-100">
            {nextMeeting.title}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            {new Date(nextMeeting.startTime).toLocaleString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <Link to={`/workspaces/${workspaceId}/meeting`} className="btn-secondary mt-4 w-full">
            Open meeting room
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-ink-300/60 p-5 text-center dark:border-white/10">
          <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
            <Video className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-ink-700 dark:text-ink-200">No meeting scheduled</p>
          <p className="mt-0.5 text-xs text-ink-400">Nobody's in the room right now.</p>
          {onSchedule && (
            <button onClick={onSchedule} className="btn-secondary mt-4 w-full">
              Schedule a meeting
            </button>
          )}
        </div>
      )}
    </div>
  );
}

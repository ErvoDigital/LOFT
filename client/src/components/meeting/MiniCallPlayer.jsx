import { useLocation, useNavigate } from "react-router-dom";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users } from "lucide-react";
import { useMeeting } from "../../context/MeetingContext.jsx";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import VideoTile from "./VideoTile.jsx";

// Rendered unconditionally in AppShell (always mounted) — self-gates on
// whether there's a live call and whether the meeting page itself is
// showing, so it only appears as a floating reminder while the call is
// running in the background on some other page.
export default function MiniCallPlayer() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspaces } = useWorkspaces();
  const { activeWorkspaceId, joined, participants, localStream, micOn, camOn, toggleMic, toggleCam, leaveMeeting } = useMeeting();

  if (!joined || !activeWorkspaceId) return null;

  const meetingPath = `/workspaces/${activeWorkspaceId}/meeting`;
  if (location.pathname === meetingPath) return null;

  const workspaceName = workspaces.find((w) => w.id === activeWorkspaceId)?.name || "Meeting";
  const count = 1 + Object.keys(participants).length;

  return (
    // Positioned relative to the content column (AppShell's wrapper next to
    // the sidebar, not the viewport), so it floats over the page content
    // instead of overlapping the sidebar's own navigation.
    <div
      onClick={() => navigate(meetingPath)}
      className="absolute bottom-4 left-4 z-40 w-56 cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-panel print:hidden"
    >
      <div className="h-32 w-full">
        <VideoTile stream={localStream} name={user.name} avatarColor={user.avatarColor} isLocal camOn={camOn} large />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">{workspaceName}</p>
          <p className="flex items-center gap-1 text-[11px] text-white/50">
            <Users className="h-3 w-3" /> {count} in call
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMic();
            }}
            title={micOn ? "Mute" : "Unmute"}
            aria-label={micOn ? "Mute" : "Unmute"}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            {micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCam();
            }}
            title={camOn ? "Turn off camera" : "Turn on camera"}
            aria-label={camOn ? "Turn off camera" : "Turn on camera"}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            {camOn ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              leaveMeeting();
            }}
            title="Leave meeting"
            aria-label="Leave meeting"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
          >
            <PhoneOff className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

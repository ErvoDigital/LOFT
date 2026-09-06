import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Video, Mic, MicOff, VideoOff, PhoneOff, ScreenShare, ScreenShareOff, PanelTop, PanelBottom, PanelLeft, PanelRight } from "lucide-react";
import { useSocket } from "../context/SocketContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useMeeting } from "../context/MeetingContext.jsx";
import { useWorkspaces } from "../context/WorkspaceContext.jsx";
import VideoTile from "../components/meeting/VideoTile.jsx";
import Modal from "../components/common/Modal.jsx";

// Camera grid density scales with headcount — more participants, smaller tiles.
// A single participant is handled separately (one big centered tile).
function gridClass(count) {
  if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  if (count <= 6) return "grid-cols-2 sm:grid-cols-3";
  if (count <= 9) return "grid-cols-3";
  return "grid-cols-3 lg:grid-cols-4";
}

// Google Meet-style circular icon buttons for the call bar — same layout/format,
// LOFT's own brand color for the "active" state instead of Meet's blue.
function ControlButton({ onClick, variant = "default", wide, title, children }) {
  const variants = {
    default: "bg-white/10 text-white hover:bg-white/20",
    off: "bg-white text-ink-900 hover:bg-white/90",
    active: "bg-brand-500 text-white hover:bg-brand-600",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-12 items-center justify-center rounded-full transition-colors ${wide ? "px-6" : "w-12"} ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

export default function WorkspaceMeeting() {
  const { workspaceId } = useParams();
  const { socket } = useSocket();
  const { user } = useAuth();
  const { workspaces } = useWorkspaces();
  const {
    activeWorkspaceId,
    joined,
    joining,
    error,
    lobbyOpen,
    pendingWorkspaceId,
    confirmWorkspaceId,
    micOn,
    camOn,
    micAvailable,
    sharingScreen,
    participants,
    remoteStreams,
    remoteScreenStreams,
    pipDock,
    setPipDock,
    localStream,
    localScreenStream,
    annotations,
    addAnnotation,
    undoAnnotation,
    updateAnnotation,
    clearAnnotations,
    promptJoin,
    cancelConfirm,
    confirmDevices,
    confirmJoin,
    cancelPrepare,
    leaveMeeting,
    switchMeeting,
    toggleMic,
    toggleCam,
    startScreenShare,
    stopScreenShare,
  } = useMeeting();

  const [preJoinCount, setPreJoinCount] = useState(0);

  const inThisWorkspacesCall = joined && activeWorkspaceId === workspaceId;
  const inAnotherWorkspacesCall = joined && activeWorkspaceId !== workspaceId;
  const lobbyForThisWorkspace = lobbyOpen && pendingWorkspaceId === workspaceId;
  const confirmForThisWorkspace = confirmWorkspaceId === workspaceId;

  // "How many are already here" for the pre-join screen — page-scoped to
  // whichever workspace is currently being viewed, independent of whatever
  // call (if any) is actually active elsewhere.
  useEffect(() => {
    if (!socket || inThisWorkspacesCall) return;
    socket.emit("meeting:status", workspaceId, (res) => res && setPreJoinCount(res.count));
    const onActivity = (payload) => {
      if (payload.workspaceId === workspaceId) setPreJoinCount(payload.count);
    };
    socket.on("meeting:activity", onActivity);
    return () => socket.off("meeting:activity", onActivity);
  }, [socket, workspaceId, inThisWorkspacesCall]);

  if (inAnotherWorkspacesCall) {
    const otherName = workspaces.find((w) => w.id === activeWorkspaceId)?.name || "another workspace";
    return (
      <div className="flex h-full items-center justify-center bg-ink-900 p-6">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
            <Video className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-white">You're in a call in {otherName}</h2>
          <p className="mt-1 text-sm text-white/50">Leave that call to join this one — you can only be in one meeting at a time.</p>
          <button onClick={() => switchMeeting(workspaceId)} className="btn-primary mt-5 w-full">
            Leave & join here
          </button>
        </div>
      </div>
    );
  }

  if (lobbyForThisWorkspace) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-900 p-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h2 className="text-lg font-semibold text-white">Check your camera and mic</h2>
          <p className="mt-1 text-sm text-white/50">Make sure you look and sound right before you join.</p>

          <div className="mx-auto mt-4 w-full">
            <VideoTile stream={localStream} name={user.name} avatarColor={user.avatarColor} isLocal camOn={camOn} />
          </div>

          <div className="mt-4 flex items-center justify-center gap-3">
            <ControlButton
              onClick={micAvailable ? toggleMic : undefined}
              variant={!micAvailable ? "off" : micOn ? "default" : "off"}
              title={!micAvailable ? "Microphone not enabled for this call" : micOn ? "Mute" : "Unmute"}
            >
              {!micAvailable || !micOn ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </ControlButton>
            <ControlButton onClick={toggleCam} variant={camOn ? "default" : "off"} title={camOn ? "Turn off camera" : "Turn on camera"}>
              {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </ControlButton>
          </div>

          {error && <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

          <div className="mt-5 flex items-center gap-2">
            <button onClick={cancelPrepare} className="btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={confirmJoin} disabled={joining} className="btn-primary flex-1">
              {joining ? "Joining…" : "Join now"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!inThisWorkspacesCall) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-900 p-6">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
            <Video className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-white">
            {preJoinCount > 0 ? "A meeting is live" : "Start a meeting"}
          </h2>
          <p className="mt-1 text-sm text-white/50">
            {preJoinCount > 0
              ? `${preJoinCount} ${preJoinCount === 1 ? "person is" : "people are"} already here.`
              : "Nobody's here yet — start one and workspace members will be notified."}
          </p>
          {error && <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          <button onClick={() => promptJoin(workspaceId)} disabled={joining} className="btn-primary mt-5 w-full">
            {joining ? "Requesting access…" : preJoinCount > 0 ? "Join meeting" : "Start meeting"}
          </button>
        </div>

        <Modal open={confirmForThisWorkspace} onClose={cancelConfirm} title="" width="max-w-sm">
          <div className="text-center">
            <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-ink-100">
              <Video className="h-9 w-9 text-ink-400" />
              <span className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white shadow-soft">
                <Video className="h-4 w-4" />
              </span>
              <span className="absolute -left-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-white shadow-soft">
                <Mic className="h-4 w-4" />
              </span>
            </div>
            <h2 className="text-lg font-semibold text-ink-900">Do you want people to see you in the meeting?</h2>
            <p className="mt-1 text-sm text-ink-400">You can still turn off your camera anytime in the meeting.</p>
            <div className="mt-5 flex flex-col gap-2">
              <button onClick={() => confirmDevices(false)} className="btn-primary w-full justify-center">
                <Video className="h-4 w-4" /> Use camera
              </button>
              <button onClick={() => confirmDevices(true)} className="btn-secondary w-full justify-center">
                <Mic className="h-4 w-4" /> Use microphone and camera
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  const remoteIds = Object.keys(participants);
  const totalCameraTiles = 1 + remoteIds.length;
  const remoteScreenIds = Object.keys(remoteScreenStreams);

  const primaryScreen = sharingScreen
    ? { stream: localScreenStream, label: "You · Presenting" }
    : remoteScreenIds.length > 0
    ? { stream: remoteScreenStreams[remoteScreenIds[0]], label: `${participants[remoteScreenIds[0]]?.name || "Guest"} · Presenting` }
    : null;

  return (
    <div className="flex h-full flex-col bg-ink-900 p-4">
      {primaryScreen ? (
        <div
          className={`flex min-h-0 flex-1 gap-3 ${
            pipDock === "bottom"
              ? "flex-col"
              : pipDock === "top"
              ? "flex-col-reverse"
              : pipDock === "left"
              ? "flex-row-reverse"
              : "flex-row"
          }`}
        >
          <div className="relative min-h-0 flex-1">
            <VideoTile
              stream={primaryScreen.stream}
              name={primaryScreen.label}
              mirrored={false}
              large
              fit="contain"
              zoomable
              annotatable
              canDraw={sharingScreen}
              annotations={annotations}
              onAddAnnotation={addAnnotation}
              onUndoAnnotation={undoAnnotation}
              onUpdateAnnotation={updateAnnotation}
              onClearAnnotations={clearAnnotations}
            />
            <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-lg bg-ink-900/60 p-1">
              {[
                { side: "top", Icon: PanelTop },
                { side: "bottom", Icon: PanelBottom },
                { side: "left", Icon: PanelLeft },
                { side: "right", Icon: PanelRight },
              ].map(({ side, Icon }) => (
                <button
                  key={side}
                  onClick={() => setPipDock(side)}
                  title={`Move camera strip to the ${side}`}
                  className={`rounded p-1 ${pipDock === side ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>

          <div className={`flex shrink-0 gap-2 ${pipDock === "left" || pipDock === "right" ? "flex-col items-center" : "flex-row justify-center"}`}>
            <div className={pipDock === "left" || pipDock === "right" ? "w-28 shrink-0" : "w-32 shrink-0"}>
              <VideoTile stream={localStream} name={user.name} avatarColor={user.avatarColor} isLocal camOn={camOn} />
            </div>
            {remoteIds.map((id) => (
              <div className={pipDock === "left" || pipDock === "right" ? "w-28 shrink-0" : "w-32 shrink-0"} key={id}>
                <VideoTile
                  stream={remoteStreams[id]}
                  name={participants[id]?.name || "Guest"}
                  avatarColor={participants[id]?.avatarColor}
                  connecting={!remoteStreams[id]}
                />
              </div>
            ))}
          </div>
        </div>
      ) : totalCameraTiles === 1 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="w-full max-w-4xl">
            <VideoTile stream={localStream} name={user.name} avatarColor={user.avatarColor} isLocal camOn={camOn} />
          </div>
        </div>
      ) : (
        <div className={`grid min-h-0 flex-1 auto-rows-fr gap-4 overflow-y-auto ${gridClass(totalCameraTiles)}`}>
          <VideoTile stream={localStream} name={user.name} avatarColor={user.avatarColor} isLocal camOn={camOn} />
          {remoteIds.map((id) => (
            <VideoTile
              key={id}
              stream={remoteStreams[id]}
              name={participants[id]?.name || "Guest"}
              avatarColor={participants[id]?.avatarColor}
              connecting={!remoteStreams[id]}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-3">
        <ControlButton
          onClick={micAvailable ? toggleMic : undefined}
          variant={!micAvailable ? "off" : micOn ? "default" : "off"}
          title={!micAvailable ? "Microphone not enabled for this call" : micOn ? "Mute" : "Unmute"}
        >
          {!micAvailable || !micOn ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </ControlButton>
        <ControlButton onClick={toggleCam} variant={camOn ? "default" : "off"} title={camOn ? "Turn off camera" : "Turn on camera"}>
          {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </ControlButton>
        <ControlButton
          onClick={sharingScreen ? stopScreenShare : startScreenShare}
          variant={sharingScreen ? "active" : "default"}
          title={sharingScreen ? "Stop sharing" : "Share screen"}
        >
          {sharingScreen ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
        </ControlButton>
        <ControlButton onClick={leaveMeeting} variant="danger" wide title="Leave meeting">
          <PhoneOff className="h-5 w-5" />
        </ControlButton>
      </div>
    </div>
  );
}

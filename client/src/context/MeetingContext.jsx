import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { PhoneOff } from "lucide-react";
import { useSocket } from "./SocketContext.jsx";
import { useAuth } from "./AuthContext.jsx";
import { useSpeakingDetection } from "../hooks/useSpeakingDetection.js";
import Modal from "../components/common/Modal.jsx";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

// Lives at the app root (see main.jsx) instead of inside the Meeting page, so
// navigating to another page no longer unmounts it and drops the call — the
// page becomes a view over this state, and MiniCallPlayer renders a small
// floating summary of it when the user isn't on the meeting page itself.
const MeetingContext = createContext(null);

// One of these per remote participant, rendered below regardless of which
// page is showing — a plain module-scope component (not a closure defined
// inside MeetingProvider) so its identity is stable across re-renders and it
// doesn't get remounted on every state change. This is what actually keeps a
// peer's voice audible after navigating away from the meeting page: the
// VideoTile elements that used to carry that audio only exist while
// WorkspaceMeeting is mounted, so leaving the page used to silence everyone
// (see VideoTile's own note on why its <video> is always muted now).
function RemoteAudioTrack({ stream }) {
  const audioRef = useRef(null);
  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = stream || null;
  }, [stream]);
  return <audio ref={audioRef} autoPlay hidden />;
}

export function MeetingProvider({ children }) {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinedAt, setJoinedAt] = useState(null);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [error, setError] = useState("");
  // True once the camera/mic stream has been acquired and previewed but
  // before the socket join actually happens — the "check your camera and
  // mic" lobby step, shown for both starting and joining a call.
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState(null);
  // The workspace a "Start/Join meeting" click is pending confirmation for —
  // set the moment the button is clicked, before getUserMedia (and so before
  // the browser's own permission prompt) is ever called, so the user picks
  // camera-only vs. camera+mic first.
  const [confirmWorkspaceId, setConfirmWorkspaceId] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  // False when the current/pending stream never requested an audio track
  // (the "Use camera" choice) — toggling mic on such a stream would be a
  // no-op, so the UI shows a "turn on your mic?" confirmation instead (see
  // micRequestOpen) rather than a plain toggle.
  const [micAvailable, setMicAvailable] = useState(true);
  const [micRequestOpen, setMicRequestOpen] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [participants, setParticipants] = useState({}); // userId -> { name, avatarColor }
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> camera MediaStream
  const [remoteScreenStreams, setRemoteScreenStreams] = useState({}); // userId -> screen-share MediaStream
  const [remoteMediaState, setRemoteMediaState] = useState({}); // userId -> { micOn, camOn }, for the per-tile status icons
  const [pipDock, setPipDock] = useState("bottom");
  const [localStream, setLocalStream] = useState(null); // mirrors localStreamRef, for consumers that need to render it (WorkspaceMeeting, MiniCallPlayer)
  const [annotations, setAnnotations] = useState([]); // shapes drawn on the shared screen, synced to every participant
  // Shown from both the meeting page's End Call button and MiniCallPlayer's —
  // rendered once at the provider level (below) so either trigger reuses the
  // same dialog regardless of which page is currently showing.
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const localStreamRef = useRef(null); // camera + mic — never touched by screen sharing
  const localScreenStreamRef = useRef(null); // the getDisplayMedia stream, while sharing
  const peersRef = useRef(new Map()); // userId -> RTCPeerConnection
  const pendingCandidatesRef = useRef(new Map()); // userId -> RTCIceCandidateInit[]
  const screenSendersRef = useRef(new Map()); // userId -> RTCRtpSender[] carrying our screen track(s) for that peer — video, plus audio when the share includes it
  const peerCameraStreamIdRef = useRef(new Map()); // userId -> the MediaStream id of their camera stream, so a later, different stream id is recognized as their screen share
  const annotationsRef = useRef([]); // mirrors `annotations` state, read inside the peer-joined handler below without needing it in that effect's deps
  const sharingScreenRef = useRef(false); // mirrors `sharingScreen` state, same reason
  const micOnRef = useRef(true); // mirrors `micOn`, read inside the peer-joined handler to answer a new joiner's implicit "what's everyone's state" question
  const camOnRef = useRef(true); // mirrors `camOn`, same reason
  const mediaSessionRef = useRef(0);
  const joinPendingRef = useRef(false);
  const deviceBusyRef = useRef(false);
  const peerScreenStreamIdRef = useRef(new Map());
  const screenRequestRef = useRef(false);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);
  useEffect(() => {
    sharingScreenRef.current = sharingScreen;
  }, [sharingScreen]);
  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);
  useEffect(() => {
    camOnRef.current = camOn;
  }, [camOn]);

  // Local + every peer's camera stream, fed to the speaking-highlight
  // detector — only while actually in a call, so no AudioContext/analysers
  // exist during the lobby or when idle.
  const speakingIds = useSpeakingDetection(joined ? { [user?.id]: localStream, ...remoteStreams } : {});

  useEffect(() => () => {
    mediaSessionRef.current++;
    peersRef.current.forEach((pc) => pc.close()); peersRef.current.clear();
    localStreamRef.current?.getTracks().forEach((track) => track.stop()); localStreamRef.current = null;
    localScreenStreamRef.current?.getTracks().forEach((track) => track.stop()); localScreenStreamRef.current = null;
  }, []);

  const createPeerConnection = useCallback(
    (peerId, isInitiator) => {
      if (peersRef.current.has(peerId)) return peersRef.current.get(peerId);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
      // A listener with no outgoing tracks still needs media sections in the
      // initial offer so the other participant can send their camera and voice.
      if (isInitiator) {
        if (!localStreamRef.current?.getAudioTracks().length) pc.addTransceiver("audio", { direction: "recvonly" });
        if (!localStreamRef.current?.getVideoTracks().length) pc.addTransceiver("video", { direction: "recvonly" });
      }
      if (localScreenStreamRef.current) {
        // One sender per track (video, plus audio when the share included
        // it) — stored as an array so stopScreenShare can remove all of
        // them; a single map slot per peer would drop every sender but the
        // last one added.
        const senders = localScreenStreamRef.current
          .getTracks()
          .map((track) => pc.addTrack(track, localScreenStreamRef.current));
        screenSendersRef.current.set(peerId, senders);
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("meeting:signal", { toUserId: peerId, data: { type: "ice", candidate: e.candidate } });
        }
      };
      pc.ontrack = (e) => {
        // Camera (audio+video) and, if they're presenting, screen share arrive as two
        // distinct MediaStreams. Whichever stream id we see first for this peer is
        // treated as their camera — true whenever screen share starts after the initial
        // connection (the common case). Browsers fire ontrack in addTrack order, so this
        // also holds for a peer who joins mid-share, since camera tracks are always added
        // before the screen track in createPeerConnection.
        const incoming = e.streams[0];
        if (!incoming) return;
        if (incoming.id === peerScreenStreamIdRef.current.get(peerId)) {
          setRemoteScreenStreams((prev) => ({ ...prev, [peerId]: incoming }));
          return;
        }
        const knownCameraId = peerCameraStreamIdRef.current.get(peerId);
        if (!knownCameraId || incoming.id === knownCameraId) {
          peerCameraStreamIdRef.current.set(peerId, incoming.id);
          setRemoteStreams((prev) => ({ ...prev, [peerId]: incoming }));
        } else {
          setRemoteScreenStreams((prev) => ({ ...prev, [peerId]: incoming }));
        }
      };
      pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          peersRef.current.delete(peerId);
        }
      };

      peersRef.current.set(peerId, pc);

      if (isInitiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit("meeting:signal", { toUserId: peerId, data: { type: "offer", sdp: pc.localDescription, cameraStreamId: localStreamRef.current?.id, screenStreamId: localScreenStreamRef.current?.id } });
          })
          .catch((err) => console.error("createOffer failed", err));
      }

      return pc;
    },
    [socket]
  );

  const flushQueued = useCallback((peerId, pc) => {
    const queued = pendingCandidatesRef.current.get(peerId) || [];
    queued.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
    pendingCandidatesRef.current.delete(peerId);
  }, []);

  useEffect(() => {
    if (!socket || !joined) return;

    const onPeerJoined = (peer) => {
      setParticipants((prev) => ({ ...prev, [peer.userId]: { name: peer.name, avatarColor: peer.avatarColor } }));
      // Catch a mid-presentation joiner up on marks already drawn — otherwise
      // everyone else's canvas has shapes theirs doesn't.
      if (sharingScreenRef.current && annotationsRef.current.length > 0) {
        socket.emit("meeting:annotation-sync", { toUserId: peer.userId, shapes: annotationsRef.current });
      }
      // A new joiner has no other way to learn our current mic/cam state —
      // media-state is only ever pushed on toggle, never polled — so
      // re-announce it now. It's a room-wide broadcast, same as the toggle
      // itself, so every other peer just gets a harmless repeat.
      socket.emit("meeting:media-state", { micOn: micOnRef.current, camOn: camOnRef.current });
    };

    const onPeerLeft = ({ userId }) => {
      peersRef.current.get(userId)?.close();
      peersRef.current.delete(userId);
      screenSendersRef.current.delete(userId);
      peerCameraStreamIdRef.current.delete(userId);
      peerScreenStreamIdRef.current.delete(userId);
      setParticipants((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setRemoteScreenStreams((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setRemoteMediaState((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const onSignal = async ({ fromUserId, data }) => {
      if (data.cameraStreamId) peerCameraStreamIdRef.current.set(fromUserId, data.cameraStreamId);
      if (data.screenStreamId) peerScreenStreamIdRef.current.set(fromUserId, data.screenStreamId);
      const pc = createPeerConnection(fromUserId, false);
      try {
        if (data.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          flushQueued(fromUserId, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("meeting:signal", { toUserId: fromUserId, data: { type: "answer", sdp: pc.localDescription, cameraStreamId: localStreamRef.current?.id, screenStreamId: localScreenStreamRef.current?.id } });

          // An answer can only fill the m-lines the offer already has, so if I'm
          // currently sharing my screen, the sender createPeerConnection already
          // attached for it has no slot in that first answer. Follow up with my own
          // offer so this (possibly brand-new) peer gets a proper m-line for it too.
          if (localScreenStreamRef.current) {
            const followUpOffer = await pc.createOffer();
            await pc.setLocalDescription(followUpOffer);
            socket.emit("meeting:signal", { toUserId: fromUserId, data: { type: "offer", sdp: pc.localDescription, cameraStreamId: localStreamRef.current?.id, screenStreamId: localScreenStreamRef.current?.id } });
          }
        } else if (data.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          flushQueued(fromUserId, pc);
        } else if (data.type === "ice") {
          if (pc.remoteDescription?.type) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
          } else {
            const queue = pendingCandidatesRef.current.get(fromUserId) || [];
            queue.push(data.candidate);
            pendingCandidatesRef.current.set(fromUserId, queue);
          }
        }
      } catch (err) {
        console.error("meeting:signal handling failed", err);
      }
    };

    const onScreenShare = ({ userId, sharing }) => {
      if (sharing) return; // the stream itself arrives via ontrack; nothing to do here
      peerScreenStreamIdRef.current.delete(userId);
      setRemoteScreenStreams((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const onMediaState = ({ userId, micOn: peerMicOn, camOn: peerCamOn }) =>
      setRemoteMediaState((prev) => ({ ...prev, [userId]: { micOn: peerMicOn, camOn: peerCamOn } }));

    const onAnnotationAdd = (shape) => setAnnotations((prev) => [...prev, shape]);
    const onAnnotationUndo = (shapeId) => setAnnotations((prev) => prev.filter((s) => s.id !== shapeId));
    const onAnnotationClear = () => setAnnotations([]);
    const onAnnotationSync = (shapes) => setAnnotations(shapes);
    const onAnnotationUpdate = ({ id, patch }) =>
      setAnnotations((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

    socket.on("meeting:peer-joined", onPeerJoined);
    socket.on("meeting:peer-left", onPeerLeft);
    socket.on("meeting:signal", onSignal);
    socket.on("meeting:screen-share", onScreenShare);
    socket.on("meeting:media-state", onMediaState);
    socket.on("meeting:annotation-add", onAnnotationAdd);
    socket.on("meeting:annotation-undo", onAnnotationUndo);
    socket.on("meeting:annotation-clear", onAnnotationClear);
    socket.on("meeting:annotation-sync", onAnnotationSync);
    socket.on("meeting:annotation-update", onAnnotationUpdate);
    return () => {
      socket.off("meeting:peer-joined", onPeerJoined);
      socket.off("meeting:peer-left", onPeerLeft);
      socket.off("meeting:signal", onSignal);
      socket.off("meeting:screen-share", onScreenShare);
      socket.off("meeting:media-state", onMediaState);
      socket.off("meeting:annotation-add", onAnnotationAdd);
      socket.off("meeting:annotation-undo", onAnnotationUndo);
      socket.off("meeting:annotation-clear", onAnnotationClear);
      socket.off("meeting:annotation-sync", onAnnotationSync);
      socket.off("meeting:annotation-update", onAnnotationUpdate);
    };
  }, [socket, joined, createPeerConnection, flushQueued]);

  // Acquire only the chosen devices. An empty stream lets someone listen
  // without requesting camera or microphone access.
  async function acquireDevices(workspaceId, options = { video: true, audio: true }) {
    if (joinPendingRef.current) return;
    const devices = typeof options === "boolean" ? { video: true, audio: options } : options;
    const session = ++mediaSessionRef.current;
    joinPendingRef.current = true;
    setPendingWorkspaceId(workspaceId);
    setError("");
    setJoining(true);
    try {
      const stream = devices.video || devices.audio ? await navigator.mediaDevices.getUserMedia(devices) : new MediaStream();
      if (session !== mediaSessionRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicAvailable(!!devices.audio);
      setMicOn(!!devices.audio); micOnRef.current = !!devices.audio;
      setCamOn(!!devices.video); camOnRef.current = !!devices.video;
      setPendingWorkspaceId(workspaceId);
      setLobbyOpen(true);
    } catch (err) {
      if (session === mediaSessionRef.current) { setPendingWorkspaceId(null); setError("Couldn't access the selected devices. Check browser permissions, or join with your camera and mic off."); }
    } finally {
      if (session === mediaSessionRef.current) { joinPendingRef.current = false; setJoining(false); }
    }
  }

  // Ask which devices to use before triggering browser permission prompts.
  function promptJoin(workspaceId) {
    if (joined || joining || joinPendingRef.current || lobbyOpen || confirmWorkspaceId) return;
    setError(""); setConfirmWorkspaceId(workspaceId);
  }

  function cancelConfirm() {
    setConfirmWorkspaceId(null);
  }

  // Called once the user picks a device combination from the confirmation —
  // this is what actually triggers getUserMedia (and the browser's native
  // permission prompt).
  function confirmDevices(options) {
    const workspaceId = confirmWorkspaceId;
    setConfirmWorkspaceId(null);
    if (!workspaceId) return;
    return acquireDevices(workspaceId, options);
  }

  // Backs out of the lobby without ever having joined the call — releases
  // the camera/mic and restores the mic/cam toggle defaults for next time.
  function cancelPrepare() {
    mediaSessionRef.current++; joinPendingRef.current = false; deviceBusyRef.current = false;
    setJoining(false); setDeviceBusy(false);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setLobbyOpen(false);
    setPendingWorkspaceId(null);
    setMicOn(true);
    setCamOn(true);
    setMicAvailable(true);
    setMicRequestOpen(false);
  }

  // The actual join, called once the user confirms from the lobby — reuses
  // the stream already acquired by acquireDevices() rather than requesting
  // getUserMedia a second time.
  function confirmJoin() {
    const workspaceId = pendingWorkspaceId;
    if (!workspaceId || !localStreamRef.current || joining || joinPendingRef.current || deviceBusyRef.current) return;
    if (!socket?.connected) {
      setError("Live connection unavailable. Wait for it to reconnect, then join again.");
      return;
    }
    setError("");
    const session = mediaSessionRef.current;
    joinPendingRef.current = true;
    setJoining(true);
    socket.emit("meeting:join", workspaceId, (res) => {
      if (session !== mediaSessionRef.current) return;
      joinPendingRef.current = false;
      if (res?.error || !Array.isArray(res?.peers)) {
        setError(res?.error || "Couldn't confirm the meeting connection. Please try again.");
        setJoining(false);
        socket.emit("meeting:leave");
        return;
      }
      const meta = {};
      (res.peers || []).forEach((p) => {
        meta[p.userId] = { name: p.name, avatarColor: p.avatarColor };
      });
      setParticipants(meta);
      setActiveWorkspaceId(workspaceId);
      setJoined(true);
      setJoinedAt(Date.now());
      setJoining(false);
      setLobbyOpen(false);
      setPendingWorkspaceId(null);
      socket.emit("meeting:media-state", { micOn: micOnRef.current, camOn: camOnRef.current });
      (res.peers || []).forEach((p) => createPeerConnection(p.userId, true));
    });
  }

  function stopLocalScreenShare() {
    screenRequestRef.current = false;
    const screenStream = localScreenStreamRef.current;
    if (!screenStream) return;
    screenStream.getTracks().forEach((t) => t.stop());
    localScreenStreamRef.current = null;
    screenSendersRef.current.clear();
    setSharingScreen(false);
  }

  function leaveMeeting() {
    if (!joined) return;
    mediaSessionRef.current++; joinPendingRef.current = false; deviceBusyRef.current = false;
    setJoining(false); setDeviceBusy(false); setJoinedAt(null);
    socket?.emit("meeting:leave");
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    stopLocalScreenShare();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    pendingCandidatesRef.current.clear();
    peerCameraStreamIdRef.current.clear();
    peerScreenStreamIdRef.current.clear();
    setParticipants({});
    setRemoteStreams({});
    setRemoteScreenStreams({});
    setRemoteMediaState({});
    setJoined(false);
    setActiveWorkspaceId(null);
    setAnnotations([]);
    setMicAvailable(true);
    setMicRequestOpen(false);
  }

  // What the "leave meeting" buttons actually call — always opens the
  // confirmation dialog first rather than hanging up immediately.
  function requestLeave() {
    if (!joined) return;
    setLeaveConfirmOpen(true);
  }

  useEffect(() => {
    if (!socket || !joined) return;
    const onDisconnect = () => {
      leaveMeeting();
      setError("The live connection was lost. Please rejoin the meeting once it reconnects.");
    };
    socket.on("disconnect", onDisconnect);
    return () => socket.off("disconnect", onDisconnect);
  }, [socket, joined]);

  function confirmLeave() {
    setLeaveConfirmOpen(false);
    leaveMeeting();
  }

  function cancelLeave() {
    setLeaveConfirmOpen(false);
  }

  // Switching workspaces starts with the same device choices as a fresh call.
  function switchMeeting(workspaceId) {
    leaveMeeting();
    setError(""); setConfirmWorkspaceId(workspaceId);
  }

  // Hard stop on logout: the socket is already disconnecting by the time this
  // fires (SocketProvider tears it down when `user` goes null), so this skips
  // the "meeting:leave" emit and just releases the camera/mic and peer
  // connections directly — otherwise the browser's camera indicator would
  // stay on with no UI left to turn it off.
  useEffect(() => {
    if (user) return;
    mediaSessionRef.current++; joinPendingRef.current = false; deviceBusyRef.current = false;
    setJoining(false); setDeviceBusy(false); setJoinedAt(null); setLeaveConfirmOpen(false);
    setConfirmWorkspaceId(null);
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    localScreenStreamRef.current?.getTracks().forEach((t) => t.stop());
    localScreenStreamRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    pendingCandidatesRef.current.clear();
    peerCameraStreamIdRef.current.clear();
    peerScreenStreamIdRef.current.clear();
    screenSendersRef.current.clear();
    setParticipants({});
    setRemoteStreams({});
    setRemoteScreenStreams({});
    setRemoteMediaState({});
    setJoined(false);
    setLobbyOpen(false);
    setPendingWorkspaceId(null);
    setActiveWorkspaceId(null);
    setSharingScreen(false);
    setAnnotations([]);
    setMicAvailable(true);
    setMicRequestOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function toggleMic() {
    if (deviceBusyRef.current || !localStreamRef.current) return;
    if (!localStreamRef.current.getAudioTracks().some((track) => track.readyState !== "ended")) return enableDevice("audio");
    const next = !micOnRef.current;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
    micOnRef.current = next;
    if (joined) socket.emit("meeting:media-state", { micOn: next, camOn: camOnRef.current });
  }

  async function toggleCam() {
    if (deviceBusyRef.current || !localStreamRef.current) return;
    if (!localStreamRef.current.getVideoTracks().some((track) => track.readyState !== "ended")) return enableDevice("video");
    const next = !camOnRef.current;
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
    camOnRef.current = next;
    if (joined) socket.emit("meeting:media-state", { micOn: micOnRef.current, camOn: next });
  }

  // Clicking the mic control when it was never requested (the "Use camera"
  // choice) opens this confirmation instead of toggling — mirrors the
  // pre-permission dialog shown before joining, just scoped to the mic alone.
  function promptEnableMic() {
    if (micAvailable) return;
    setMicRequestOpen(true);
  }

  function cancelMicRequest() {
    setMicRequestOpen(false);
  }

  // Requests a mic track after the fact and folds it into the call already
  // in progress — adds it to the existing local stream and, for any peer
  // already connected, renegotiates so they start receiving audio too
  // (same offer/renegotiate pattern as startScreenShare).
  async function confirmEnableMic() {
    setMicRequestOpen(false);
    return enableDevice("audio");
  }

  async function enableDevice(kind) {
    if (deviceBusyRef.current || !localStreamRef.current) return;
    const session = mediaSessionRef.current, stream = localStreamRef.current;
    deviceBusyRef.current = true; setDeviceBusy(true); setError("");
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ [kind]: true });
      if (session !== mediaSessionRef.current || stream !== localStreamRef.current) { acquired.getTracks().forEach((track) => track.stop()); return; }
      const track = acquired.getTracks().find((item) => item.kind === kind);
      if (!track) { acquired.getTracks().forEach((item) => item.stop()); throw new Error("No media track"); }
      stream.addTrack(track);
      if (kind === "audio") { setMicAvailable(true); setMicOn(true); micOnRef.current = true; }
      else { setCamOn(true); camOnRef.current = true; }
      // Keep the stream id stable for peers; changing the object refreshes
      // the local preview and speaking detection after adding a track.
      setLocalStream(new MediaStream(stream.getTracks()));

      for (const [peerId, pc] of peersRef.current) {
        if (session !== mediaSessionRef.current) break;
        pc.addTrack(track, stream);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (session === mediaSessionRef.current) socket.emit("meeting:signal", { toUserId: peerId, data: { type: "offer", sdp: pc.localDescription, cameraStreamId: stream.id, screenStreamId: localScreenStreamRef.current?.id } });
        } catch (err) {
          console.error("device renegotiation failed", err);
        }
      }

      if (session === mediaSessionRef.current && joined) socket.emit("meeting:media-state", { micOn: micOnRef.current, camOn: camOnRef.current });
    } catch (err) {
      if (session === mediaSessionRef.current) setError(`Couldn't access your ${kind === "audio" ? "microphone" : "camera"}. Check your browser permissions and try again.`);
    } finally { if (session === mediaSessionRef.current) { deviceBusyRef.current = false; setDeviceBusy(false); } }
  }

  // Local update + broadcast so every participant's canvas matches. Used both
  // by the annotation toolbar and to start each new presentation with a blank
  // slate (marks from a previous share shouldn't bleed into the next one).
  function clearAnnotations() {
    setAnnotations([]);
    socket?.emit("meeting:annotation-clear");
  }

  function addAnnotation(shape) {
    setAnnotations((prev) => [...prev, shape]);
    socket?.emit("meeting:annotation-add", shape);
  }

  function undoAnnotation() {
    setAnnotations((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      socket?.emit("meeting:annotation-undo", last.id);
      return prev.slice(0, -1);
    });
  }

  function updateAnnotation(id, patch) {
    setAnnotations((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    socket?.emit("meeting:annotation-update", { id, patch });
  }

  async function startScreenShare() {
    if (sharingScreen || screenRequestRef.current || !joined) return;
    const session = mediaSessionRef.current;
    screenRequestRef.current = true;
    try {
      // `audio: true` only makes the browser's own share picker offer a
      // "share audio" checkbox — most browsers only honor it for a tab/
      // window share, not a full screen, and it's silently absent if the
      // user leaves it unchecked. Either way the resulting stream just has
      // no audio track, so nothing else here needs to special-case it.
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (session !== mediaSessionRef.current) { displayStream.getTracks().forEach((track) => track.stop()); return; }
      const screenStream = new MediaStream(displayStream.getTracks());
      localScreenStreamRef.current = screenStream;
      clearAnnotations();

      for (const [peerId, pc] of peersRef.current) {
        if (session !== mediaSessionRef.current) break;
        const senders = screenStream.getTracks().map((track) => pc.addTrack(track, screenStream));
        screenSendersRef.current.set(peerId, senders);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (session === mediaSessionRef.current) socket.emit("meeting:signal", { toUserId: peerId, data: { type: "offer", sdp: pc.localDescription, cameraStreamId: localStreamRef.current?.id, screenStreamId: localScreenStreamRef.current?.id } });
        } catch (err) {
          console.error("screen-share offer failed", err);
        }
      }

      if (session !== mediaSessionRef.current) return;
      screenStream.getVideoTracks()[0].onended = () => { if (localScreenStreamRef.current === screenStream) stopScreenShare(); };
      socket.emit("meeting:screen-share", { sharing: true });
      setSharingScreen(true);
    } catch (err) {
      // User cancelled the share picker or denied permission — nothing to do.
    } finally { if (session === mediaSessionRef.current) screenRequestRef.current = false; }
  }

  async function stopScreenShare() {
    if (!localScreenStreamRef.current) return;
    const session = mediaSessionRef.current;

    for (const [peerId, pc] of peersRef.current) {
      const senders = screenSendersRef.current.get(peerId);
      if (!senders) continue;
      senders.forEach((sender) => pc.removeTrack(sender));
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("meeting:signal", { toUserId: peerId, data: { type: "offer", sdp: pc.localDescription, cameraStreamId: localStreamRef.current?.id, screenStreamId: localScreenStreamRef.current?.id } });
      } catch (err) {
        console.error("stop-share renegotiation failed", err);
      }
    }

    if (session !== mediaSessionRef.current) return;
    stopLocalScreenShare();
    socket.emit("meeting:screen-share", { sharing: false });
    clearAnnotations();
  }

  const value = {
    activeWorkspaceId,
    joined,
    joining,
    joinedAt,
    deviceBusy,
    error,
    lobbyOpen,
    pendingWorkspaceId,
    confirmWorkspaceId,
    micOn,
    camOn,
    micAvailable,
    micRequestOpen,
    sharingScreen,
    participants,
    remoteStreams,
    remoteScreenStreams,
    remoteMediaState,
    speakingIds,
    pipDock,
    setPipDock,
    localStream,
    localScreenStream: localScreenStreamRef.current,
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
    leaveConfirmOpen,
    requestLeave,
    confirmLeave,
    cancelLeave,
    switchMeeting,
    toggleMic,
    toggleCam,
    promptEnableMic,
    cancelMicRequest,
    confirmEnableMic,
    startScreenShare,
    stopScreenShare,
  };

  return (
    <MeetingContext.Provider value={value}>
      {children}
      {joined &&
        Object.entries(remoteStreams).map(([userId, stream]) => <RemoteAudioTrack key={userId} stream={stream} />)}
      <Modal open={leaveConfirmOpen} onClose={cancelLeave} title="" width="max-w-xs">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-600">
            <PhoneOff className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">Leave this meeting?</h2>
          <p className="mt-1 text-sm text-ink-400">You'll be disconnected from this meeting.</p>
          <div className="mt-4 flex items-center gap-2">
            <button onClick={cancelLeave} className="btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={confirmLeave} className="btn-danger flex-1">
              Leave meeting
            </button>
          </div>
        </div>
      </Modal>
    </MeetingContext.Provider>
  );
}

export function useMeeting() {
  const ctx = useContext(MeetingContext);
  if (!ctx) throw new Error("useMeeting must be used within MeetingProvider");
  return ctx;
}

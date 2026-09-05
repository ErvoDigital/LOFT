import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSocket } from "./SocketContext.jsx";
import { useAuth } from "./AuthContext.jsx";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

// Lives at the app root (see main.jsx) instead of inside the Meeting page, so
// navigating to another page no longer unmounts it and drops the call — the
// page becomes a view over this state, and MiniCallPlayer renders a small
// floating summary of it when the user isn't on the meeting page itself.
const MeetingContext = createContext(null);

export function MeetingProvider({ children }) {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [participants, setParticipants] = useState({}); // userId -> { name, avatarColor }
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> camera MediaStream
  const [remoteScreenStreams, setRemoteScreenStreams] = useState({}); // userId -> screen-share MediaStream
  const [pipDock, setPipDock] = useState("bottom");
  const [localStream, setLocalStream] = useState(null); // mirrors localStreamRef, for consumers that need to render it (WorkspaceMeeting, MiniCallPlayer)
  const [annotations, setAnnotations] = useState([]); // shapes drawn on the shared screen, synced to every participant

  const localStreamRef = useRef(null); // camera + mic — never touched by screen sharing
  const localScreenStreamRef = useRef(null); // the getDisplayMedia stream, while sharing
  const peersRef = useRef(new Map()); // userId -> RTCPeerConnection
  const pendingCandidatesRef = useRef(new Map()); // userId -> RTCIceCandidateInit[]
  const screenSendersRef = useRef(new Map()); // userId -> RTCRtpSender carrying our screen track for that peer
  const peerCameraStreamIdRef = useRef(new Map()); // userId -> the MediaStream id of their camera stream, so a later, different stream id is recognized as their screen share
  const annotationsRef = useRef([]); // mirrors `annotations` state, read inside the peer-joined handler below without needing it in that effect's deps
  const sharingScreenRef = useRef(false); // mirrors `sharingScreen` state, same reason

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);
  useEffect(() => {
    sharingScreenRef.current = sharingScreen;
  }, [sharingScreen]);

  const createPeerConnection = useCallback(
    (peerId, isInitiator) => {
      if (peersRef.current.has(peerId)) return peersRef.current.get(peerId);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach((track) => {
          screenSendersRef.current.set(peerId, pc.addTrack(track, localScreenStreamRef.current));
        });
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
            socket.emit("meeting:signal", { toUserId: peerId, data: { type: "offer", sdp: pc.localDescription } });
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
    };

    const onPeerLeft = ({ userId }) => {
      peersRef.current.get(userId)?.close();
      peersRef.current.delete(userId);
      screenSendersRef.current.delete(userId);
      peerCameraStreamIdRef.current.delete(userId);
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
    };

    const onSignal = async ({ fromUserId, data }) => {
      const pc = createPeerConnection(fromUserId, false);
      try {
        if (data.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          flushQueued(fromUserId, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("meeting:signal", { toUserId: fromUserId, data: { type: "answer", sdp: pc.localDescription } });

          // An answer can only fill the m-lines the offer already has, so if I'm
          // currently sharing my screen, the sender createPeerConnection already
          // attached for it has no slot in that first answer. Follow up with my own
          // offer so this (possibly brand-new) peer gets a proper m-line for it too.
          if (localScreenStreamRef.current) {
            const followUpOffer = await pc.createOffer();
            await pc.setLocalDescription(followUpOffer);
            socket.emit("meeting:signal", { toUserId: fromUserId, data: { type: "offer", sdp: pc.localDescription } });
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
      setRemoteScreenStreams((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

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
      socket.off("meeting:annotation-add", onAnnotationAdd);
      socket.off("meeting:annotation-undo", onAnnotationUndo);
      socket.off("meeting:annotation-clear", onAnnotationClear);
      socket.off("meeting:annotation-sync", onAnnotationSync);
      socket.off("meeting:annotation-update", onAnnotationUpdate);
    };
  }, [socket, joined, createPeerConnection, flushQueued]);

  // The actual acquire-media-and-join sequence, with no guard against an
  // already-active call — used directly by switchMeeting() right after it
  // tears the old call down, so it can't be blocked by `joined` still
  // reading true from this render's stale closure (leaveMeeting()'s
  // setJoined(false) hasn't been applied yet at that point).
  async function acquireAndJoin(workspaceId) {
    setError("");
    setJoining(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);

      socket.emit("meeting:join", workspaceId, (res) => {
        if (res?.error) {
          setError(res.error);
          setJoining(false);
          stream.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
          setLocalStream(null);
          return;
        }
        const meta = {};
        (res.peers || []).forEach((p) => {
          meta[p.userId] = { name: p.name, avatarColor: p.avatarColor };
        });
        setParticipants(meta);
        setActiveWorkspaceId(workspaceId);
        setJoined(true);
        setJoining(false);
        (res.peers || []).forEach((p) => createPeerConnection(p.userId, true));
      });
    } catch (err) {
      setError("Couldn't access your camera or microphone. Check your browser permissions and try again.");
      setJoining(false);
    }
  }

  function joinMeeting(workspaceId) {
    if (joined || joining) return;
    return acquireAndJoin(workspaceId);
  }

  function stopLocalScreenShare() {
    const screenStream = localScreenStreamRef.current;
    if (!screenStream) return;
    screenStream.getTracks().forEach((t) => t.stop());
    localScreenStreamRef.current = null;
    screenSendersRef.current.clear();
    setSharingScreen(false);
  }

  function leaveMeeting() {
    if (!joined) return;
    socket?.emit("meeting:leave");
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    stopLocalScreenShare();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    pendingCandidatesRef.current.clear();
    peerCameraStreamIdRef.current.clear();
    setParticipants({});
    setRemoteStreams({});
    setRemoteScreenStreams({});
    setJoined(false);
    setActiveWorkspaceId(null);
    setAnnotations([]);
  }

  // Leaves whatever call is currently active and immediately joins a
  // different workspace's — used by the "leave & join here" cross-workspace
  // prompt. Goes through acquireAndJoin directly (not joinMeeting) since
  // leaveMeeting()'s setJoined(false) hasn't taken effect yet at this point
  // in the same synchronous call — joinMeeting's `if (joined) return` guard
  // would still see the pre-leave value and no-op.
  function switchMeeting(workspaceId) {
    leaveMeeting();
    return acquireAndJoin(workspaceId);
  }

  // Hard stop on logout: the socket is already disconnecting by the time this
  // fires (SocketProvider tears it down when `user` goes null), so this skips
  // the "meeting:leave" emit and just releases the camera/mic and peer
  // connections directly — otherwise the browser's camera indicator would
  // stay on with no UI left to turn it off.
  useEffect(() => {
    if (user || !joined) return;
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    localScreenStreamRef.current?.getTracks().forEach((t) => t.stop());
    localScreenStreamRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    pendingCandidatesRef.current.clear();
    peerCameraStreamIdRef.current.clear();
    screenSendersRef.current.clear();
    setParticipants({});
    setRemoteStreams({});
    setRemoteScreenStreams({});
    setJoined(false);
    setActiveWorkspaceId(null);
    setSharingScreen(false);
    setAnnotations([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function toggleMic() {
    const next = !micOn;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }

  function toggleCam() {
    const next = !camOn;
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
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
    if (sharingScreen) return;
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = displayStream.getVideoTracks()[0];
      const screenStream = new MediaStream([screenTrack]);
      localScreenStreamRef.current = screenStream;
      clearAnnotations();

      for (const [peerId, pc] of peersRef.current) {
        screenSendersRef.current.set(peerId, pc.addTrack(screenTrack, screenStream));
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("meeting:signal", { toUserId: peerId, data: { type: "offer", sdp: pc.localDescription } });
        } catch (err) {
          console.error("screen-share offer failed", err);
        }
      }

      screenTrack.onended = () => stopScreenShare();
      socket.emit("meeting:screen-share", { sharing: true });
      setSharingScreen(true);
    } catch (err) {
      // User cancelled the share picker or denied permission — nothing to do.
    }
  }

  async function stopScreenShare() {
    if (!localScreenStreamRef.current) return;

    for (const [peerId, pc] of peersRef.current) {
      const sender = screenSendersRef.current.get(peerId);
      if (!sender) continue;
      pc.removeTrack(sender);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("meeting:signal", { toUserId: peerId, data: { type: "offer", sdp: pc.localDescription } });
      } catch (err) {
        console.error("stop-share renegotiation failed", err);
      }
    }

    stopLocalScreenShare();
    socket.emit("meeting:screen-share", { sharing: false });
    clearAnnotations();
  }

  const value = {
    activeWorkspaceId,
    joined,
    joining,
    error,
    micOn,
    camOn,
    sharingScreen,
    participants,
    remoteStreams,
    remoteScreenStreams,
    pipDock,
    setPipDock,
    localStream,
    localScreenStream: localScreenStreamRef.current,
    annotations,
    addAnnotation,
    undoAnnotation,
    updateAnnotation,
    clearAnnotations,
    joinMeeting,
    leaveMeeting,
    switchMeeting,
    toggleMic,
    toggleCam,
    startScreenShare,
    stopScreenShare,
  };

  return <MeetingContext.Provider value={value}>{children}</MeetingContext.Provider>;
}

export function useMeeting() {
  const ctx = useContext(MeetingContext);
  if (!ctx) throw new Error("useMeeting must be used within MeetingProvider");
  return ctx;
}

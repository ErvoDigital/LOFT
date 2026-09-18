import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { useSocket } from "./SocketContext.jsx";

const PresenceContext = createContext(null);

const HEARTBEAT_MS = 30_000;
// Two missed heartbeats plus slack. This is the only offline signal that
// survives a realtime isolate dying without ever firing its close handler.
const TTL_MS = 70_000;

// App-wide rather than inside the member list, so this user keeps announcing
// themselves while they're on pages that don't show anyone's status.
export function PresenceProvider({ children }) {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const [lastSeen, setLastSeen] = useState(() => new Map());
  // Stays false until the realtime service echoes a presence event. A service
  // that predates presence then shows no status at all, instead of reporting
  // every teammate as offline.
  const [supported, setSupported] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setLastSeen(new Map());
    setSupported(false);
  }, [user?.id]);

  useEffect(() => {
    if (!socket || !connected) return;

    const heartbeat = () => socket.emit("presence:heartbeat");
    const onOnline = ({ userId } = {}) => {
      if (!userId) return;
      setSupported(true);
      setLastSeen((prev) => new Map(prev).set(userId, Date.now()));
    };
    const onOffline = ({ userId } = {}) => {
      if (!userId) return;
      setLastSeen((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    };
    const timers = new Set();
    const onPing = ({ userId } = {}) => {
      if (userId === user?.id) return;
      // Jittered so a new arrival isn't answered by every member in one burst.
      const t = setTimeout(() => {
        timers.delete(t);
        heartbeat();
      }, Math.random() * 1500);
      timers.add(t);
    };

    socket.on("presence:online", onOnline);
    socket.on("presence:offline", onOffline);
    socket.on("presence:ping", onPing);

    socket.emit("presence:ping");
    heartbeat();
    const beat = setInterval(heartbeat, HEARTBEAT_MS);

    return () => {
      clearInterval(beat);
      timers.forEach(clearTimeout);
      socket.off("presence:online", onOnline);
      socket.off("presence:offline", onOffline);
      socket.off("presence:ping", onPing);
    };
  }, [socket, connected, user?.id]);

  // Ages entries past the TTL even when no new event arrives to re-render.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const isOnline = useCallback(
    (userId) => {
      if (!userId) return false;
      if (userId === user?.id) return connected;
      const seen = lastSeen.get(userId);
      return seen !== undefined && now - seen < TTL_MS;
    },
    [lastSeen, now, user?.id, connected]
  );

  return <PresenceContext.Provider value={{ supported, isOnline }}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error("usePresence must be used within PresenceProvider");
  return ctx;
}

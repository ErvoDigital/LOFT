import { createContext, useContext, useEffect, useState } from "react";
import { SocketLike } from "../lib/socketShim.js";
import { useAuth } from "./AuthContext.jsx";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const token = localStorage.getItem("loft_token");
    const socket = new SocketLike(import.meta.env.VITE_REALTIME_URL || "/", token);
    let active = true;
    setSocket(socket);
    setConnected(false);

    socket.on("connect", () => active && setConnected(true));
    socket.on("disconnect", () => active && setConnected(false));

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}

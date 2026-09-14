import { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as notificationsApi from "../api/notifications.js";
import { useAuth } from "./AuthContext.jsx";
import { useSocket } from "./SocketContext.jsx";
import NotificationToasts from "../components/notifications/NotificationToasts.jsx";

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const data = await notificationsApi.listNotifications();
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }, [user]);

  useEffect(() => {
    if (user) refresh();
    else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, refresh]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
      // Every notification also pops an instant toast (NotificationToasts.jsx)
      // below the bell in Topbar.jsx, on top of the persistent bell entry.
      setToasts((prev) => [...prev, notification].slice(-4));
    };
    socket.on("notification:new", onNew);
    return () => socket.off("notification:new", onNew);
  }, [socket]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await notificationsApi.markNotificationRead(id);
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await notificationsApi.markAllNotificationsRead();
  }, []);

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, refresh, markRead, markAllRead, toasts, dismissToast }}
    >
      {children}
      <NotificationToasts />
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}

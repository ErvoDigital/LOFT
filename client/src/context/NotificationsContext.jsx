import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import * as notificationsApi from "../api/notifications.js";
import { apiErrorMessage } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";
import { useSocket } from "./SocketContext.jsx";

const NotificationsContext = createContext(null);
const emptyState = (userId) => ({ userId, notifications: [], unreadCount: 0, toasts: [], error: "" });
const appIsActive = () => document.visibilityState === "visible" && document.hasFocus();

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { socket } = useSocket();
  const accountRef = useRef(null);
  const [state, setState] = useState(() => emptyState(userId));

  const commit = useCallback((account, changes) => {
    if (accountRef.current !== account) return;
    account.state = { ...account.state, ...changes };
    setState(account.state);
  }, []);

  const refresh = useCallback(async () => {
    const account = accountRef.current;
    if (!userId || account?.state.userId !== userId) return false;
    const request = ++account.request;
    try {
      // A notification or read action arriving during a fetch makes that
      // snapshot stale. Retry once without overwriting the live state.
      for (let attempt = 0; attempt < 2; attempt++) {
        const revision = account.revision;
        const data = await notificationsApi.listNotifications();
        if (accountRef.current !== account || account.request !== request) return false;
        if (account.revision !== revision) continue;
        const notifications = data.notifications || [];
        notifications.forEach((notification) => account.seen.add(notification.id));
        commit(account, { notifications, unreadCount: data.unreadCount || 0, error: "" });
        return true;
      }
    } catch (err) { if (account.request === request) commit(account, { error: apiErrorMessage(err) }); }
    return false;
  }, [userId, commit]);

  useEffect(() => {
    const account = { state: emptyState(userId), seen: new Set(), request: 0, revision: 0, reads: new Map(), readAll: null };
    accountRef.current = account;
    setState(account.state);
    if (userId) refresh();
    return () => { if (accountRef.current === account) accountRef.current = null; };
  }, [userId, refresh]);

  useEffect(() => {
    if (!socket || !userId) return;
    const account = accountRef.current;
    const onNew = (notification) => {
      if (accountRef.current !== account || !notification?.id || (notification.userId && notification.userId !== userId) || account.seen.has(notification.id)) return;
      account.seen.add(notification.id);
      if (account.seen.size > 2000) account.seen.delete(account.seen.values().next().value);
      account.revision++;
      const current = account.state;
      commit(account, {
        notifications: [notification, ...current.notifications].slice(0, 50),
        unreadCount: current.unreadCount + (notification.isRead ? 0 : 1),
        toasts: appIsActive() && !notification.isRead && !notification.silent ? [...current.toasts, notification].slice(-3) : current.toasts,
      });
    };
    socket.on("notification:new", onNew);
    socket.on("notification:resumed", refresh);
    socket.on("connect", refresh);
    return () => { socket.off("notification:new", onNew); socket.off("notification:resumed", refresh); socket.off("connect", refresh); };
  }, [socket, userId, refresh, commit]);

  useEffect(() => {
    const onActivityChange = () => {
      const account = accountRef.current;
      if (!account || !userId) return;
      if (!appIsActive()) commit(account, { toasts: [] });
      else refresh();
    };
    window.addEventListener("focus", onActivityChange);
    window.addEventListener("blur", onActivityChange);
    document.addEventListener("visibilitychange", onActivityChange);
    return () => {
      window.removeEventListener("focus", onActivityChange);
      window.removeEventListener("blur", onActivityChange);
      document.removeEventListener("visibilitychange", onActivityChange);
    };
  }, [userId, refresh, commit]);

  const dismissToast = useCallback((id) => {
    const account = accountRef.current;
    if (account) commit(account, { toasts: account.state.toasts.filter((toast) => toast.id !== id) });
  }, [commit]);

  const markRead = useCallback(async (id) => {
    const account = accountRef.current;
    if (!userId || account?.state.userId !== userId) return false;
    if (account.reads.has(id)) return account.reads.get(id);
    const notification = account.state.notifications.find((item) => item.id === id);
    if (!notification || notification.isRead) return true;
    const request = (async () => {
      try {
        await notificationsApi.markNotificationRead(id);
        if (accountRef.current !== account) return false;
        const stillUnread = account.state.notifications.some((item) => item.id === id && !item.isRead);
        account.revision++;
        commit(account, {
          notifications: account.state.notifications.map((item) => item.id === id ? { ...item, isRead: true } : item),
          unreadCount: Math.max(0, account.state.unreadCount - (stillUnread ? 1 : 0)),
          toasts: account.state.toasts.filter((toast) => toast.id !== id), error: "",
        });
        return true;
      } catch (err) { commit(account, { error: apiErrorMessage(err) }); return false; }
      finally { account.reads.delete(id); }
    })();
    account.reads.set(id, request);
    return request;
  }, [userId, commit]);

  const markAllRead = useCallback(async () => {
    const account = accountRef.current;
    if (!userId || account?.state.userId !== userId) return false;
    if (account.readAll) return account.readAll;
    const ids = new Set(account.state.notifications.map((notification) => notification.id));
    account.readAll = (async () => {
      try {
        await notificationsApi.markAllNotificationsRead();
        if (accountRef.current !== account) return false;
        const notifications = account.state.notifications.map((item) => ids.has(item.id) ? { ...item, isRead: true } : item);
        account.revision++;
        commit(account, { notifications, unreadCount: notifications.filter((item) => !item.isRead).length, toasts: account.state.toasts.filter((toast) => !ids.has(toast.id)), error: "" });
        await refresh();
        return true;
      } catch (err) { commit(account, { error: apiErrorMessage(err) }); return false; }
      finally { account.readAll = null; }
    })();
    return account.readAll;
  }, [userId, commit, refresh]);

  const visibleState = state.userId === userId ? state : emptyState(userId);
  return <NotificationsContext.Provider value={{ ...visibleState, refresh, markRead, markAllRead, dismissToast }}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("useNotifications must be used within NotificationsProvider");
  return context;
}

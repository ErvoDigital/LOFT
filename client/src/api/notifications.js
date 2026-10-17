import { api } from "./client.js";

export const listNotifications = () => api.get("/notifications").then((r) => r.data);
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`).then((r) => r.data);
export const markAllNotificationsRead = () => api.post("/notifications/read-all").then((r) => r.data);
export const getPreferences = () => api.get("/notifications/preferences").then((r) => r.data.preferences);
export const savePreferences = (preferences) => api.patch("/notifications/preferences", preferences).then((r) => r.data.preferences);
export const snoozeNotification = (id, minutes) => api.post(`/notifications/${id}/snooze`, { minutes });

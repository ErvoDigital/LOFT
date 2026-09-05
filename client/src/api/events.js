import { api } from "./client.js";

export const listMyEvents = (params) => api.get("/events", { params }).then((r) => r.data.events);
export const listWorkspaceEvents = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/events`).then((r) => r.data.events);
export const createEvent = (workspaceId, data) =>
  api.post(`/workspaces/${workspaceId}/events`, data).then((r) => r.data.event);
export const updateEvent = (workspaceId, eventId, data) =>
  api.patch(`/workspaces/${workspaceId}/events/${eventId}`, data).then((r) => r.data.event);
export const cancelEvent = (workspaceId, eventId) =>
  api.delete(`/workspaces/${workspaceId}/events/${eventId}`).then((r) => r.data);

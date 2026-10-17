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
export const listEventDrafts = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/events/drafts`).then((r) => r.data.drafts);
export const updateEventDraft = (workspaceId, draftId, data) =>
  api.patch(`/workspaces/${workspaceId}/events/drafts/${draftId}`, data).then((r) => r.data.draft);
export const deleteEventDraft = (workspaceId, draftId) =>
  api.delete(`/workspaces/${workspaceId}/events/drafts/${draftId}`).then((r) => r.data);
export const scheduleEventDraft = (workspaceId, draftId, data) =>
  api.post(`/workspaces/${workspaceId}/events/drafts/${draftId}/schedule`, data).then((r) => r.data.event);
export const previewConflicts = (workspaceId, data, signal) => api.post(`/workspaces/${workspaceId}/events/preview-conflicts`, data, { signal }).then((r) => r.data.conflicts);
export const getAvailability = (workspaceId, eventId) => api.get(`/workspaces/${workspaceId}/events/${eventId}/availability`, { params: { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } }).then((r) => r.data);
export const respondToEvent = (workspaceId, eventId, response) => api.post(`/workspaces/${workspaceId}/events/${eventId}/respond`, { response });

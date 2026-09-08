import { api } from "./client.js";

export const listWorkspaceConversations = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/conversations`).then((r) => r.data.conversations);

export const createWorkspaceConversation = (workspaceId, { title, memberIds }) =>
  api.post(`/workspaces/${workspaceId}/conversations`, { title, memberIds }).then((r) => r.data.conversation);

export const deleteWorkspaceConversation = (workspaceId, conversationId) =>
  api.delete(`/workspaces/${workspaceId}/conversations/${conversationId}`).then((r) => r.data);

// The meeting page's own chat channel — separate from General so meeting
// chatter doesn't mix into regular workspace chat history. Finds it if it
// already exists, creates it (and/or adds the caller as a participant) if
// not — safe to call every time the chat panel opens.
export const getOrCreateMeetingChat = (workspaceId) =>
  api.post(`/workspaces/${workspaceId}/conversations/meeting-chat`).then((r) => r.data.conversation);

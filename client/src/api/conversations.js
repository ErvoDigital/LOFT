import { api } from "./client.js";

export const listWorkspaceConversations = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/conversations`).then((r) => r.data.conversations);

export const createWorkspaceConversation = (workspaceId, { title, memberIds }) =>
  api.post(`/workspaces/${workspaceId}/conversations`, { title, memberIds }).then((r) => r.data.conversation);

export const deleteWorkspaceConversation = (workspaceId, conversationId) =>
  api.delete(`/workspaces/${workspaceId}/conversations/${conversationId}`).then((r) => r.data);

import { api } from "./client.js";

export const listConversations = () => api.get("/messages/conversations").then((r) => r.data.conversations);
export const getMessages = (conversationId) =>
  api.get(`/messages/conversations/${conversationId}/messages`).then((r) => r.data.messages);
export const startDirectMessage = (userId) =>
  api.post(`/messages/dm/${userId}`).then((r) => r.data.conversationId);

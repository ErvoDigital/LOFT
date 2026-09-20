import { api } from "./client.js";

export const listConversations = () => api.get("/messages/conversations").then((r) => r.data.conversations);
export const getMessages = (conversationId) =>
  api.get(`/messages/conversations/${conversationId}/messages`).then((r) => r.data.messages);
export const startDirectMessage = (userId) =>
  api.post(`/messages/dm/${userId}`).then((r) => r.data.conversationId);
export const toggleReaction = (conversationId, messageId, emoji) =>
  api
    .post(`/messages/conversations/${conversationId}/messages/${messageId}/reactions`, { emoji })
    .then((r) => r.data.reactions);
export const deleteMessage = (conversationId, messageId) =>
  api.delete(`/messages/conversations/${conversationId}/messages/${messageId}`).then((r) => r.data);
// Removes a chat from your own Messages list, leaving it intact for everyone
// else. `purge` is the opt-in that deletes the conversation and its messages
// for all of its participants; the server decides whether you're allowed to
// (see deleteConversation in messages.controller.js).
export const deleteConversation = (conversationId, { purge = false } = {}) =>
  api.delete(`/messages/conversations/${conversationId}`, { params: purge ? { purge: true } : {} }).then((r) => r.data);

export const MESSAGE_LIMIT = 4000;

export function plainMessage(content = "") {
  return content.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1");
}

export function conversationPreview(conversation, selfId) {
  const message = conversation.lastMessage;
  if (!message) return conversation.isGroup ? "No messages yet" : "Start a conversation";
  const content = plainMessage(message.content || "").replace(/\s+/g, " ").trim()
    || (message.attachment ? `Attachment: ${message.attachment.name}` : "Message removed");
  const sender = message.sender?.id === selfId ? "You" : message.sender?.name?.split(" ")[0];
  return sender && (conversation.isGroup || message.sender?.id === selfId) ? `${sender}: ${content}` : content;
}

export function conversationMatches(conversation, query) {
  const needle = query.trim().toLocaleLowerCase();
  return !needle || [conversation.title, ...((conversation.participants || []).map((p) => p.name))]
    .some((value) => value?.toLocaleLowerCase().includes(needle));
}

export function activityLabel(value, now = new Date()) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric", ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

export function dayLabel(value, now = new Date()) {
  const date = new Date(value);
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

export function mergeMessages(existing, incoming) {
  const byId = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id.localeCompare(b.id));
}

export function readChatDraft(userId, conversationId) {
  try { return sessionStorage.getItem(`loft:chat-draft:${userId}:${conversationId}`) || ""; }
  catch { return ""; }
}

export function saveChatDraft(userId, conversationId, value) {
  try {
    const key = `loft:chat-draft:${userId}:${conversationId}`;
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch { /* The composer still works when browser storage is unavailable. */ }
}

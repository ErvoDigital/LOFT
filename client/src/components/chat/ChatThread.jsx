import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import MessageActions from "./MessageActions.jsx";
import {
  MessageCircle,
  MessageSquare,
  Paperclip,
  Smile,
  Trash2,
  X,
  File as FileIcon,
  Film,
  Image as ImageIcon,
  Music,
  FileText,
  Search,
  ArrowDown,
  Users,
  Copy,
} from "lucide-react";
import * as messagesApi from "../../api/messages.js";
import * as assetsApi from "../../api/assets.js";
import { apiErrorMessage } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSocket } from "../../context/SocketContext.jsx";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";
import { useConfirm } from "../../context/ConfirmContext.jsx";
import { useMemberProfile } from "../../context/MemberProfileContext.jsx";
import Avatar from "../common/Avatar.jsx";
import EmptyState from "../common/EmptyState.jsx";
import Spinner from "../common/Spinner.jsx";
import Modal from "../common/Modal.jsx";
import PreviewModal from "../storage/PreviewModal.jsx";
import UploadProgressPanel from "../storage/UploadProgressPanel.jsx";
import EmojiPicker from "./EmojiPicker.jsx";
import { displayColor, textOn } from "../../lib/colors.js";
import useMediaQuery from "../../hooks/useMediaQuery.js";
import { can } from "../../lib/access.js";
import { ACCEPTED_UPLOAD_TYPES } from "../../lib/uploads.js";
import { MESSAGE_LIMIT, dayLabel, mergeMessages, plainMessage, readChatDraft, saveChatDraft } from "../../lib/chat.js";

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// `@[Name](userId)` is the wire format for a resolved mention — written by
// applyMentions() below at send time, parsed back into a highlighted span by
// renderContent(). The server (chat.socket.js / realtime's index.js)
// re-validates every id against the conversation's participant list before
// notifying anyone, since content is otherwise untrusted client input.
const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g;
const MENTION_TRIGGER_RE = /(?:^|\s)@([^\s@]{0,40})$/;

function timeLabel(date) {
  return new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Turns any "@Full Name" substring that matches a real conversation
// participant into the `@[Name](id)` wire format. Runs at send time against
// whatever the composer currently holds, so it resolves a mention whether it
// was typed by hand or inserted from the autocomplete dropdown. Longest
// names are matched first so "Ann" can't shadow "Anna".
function applyMentions(text, candidates) {
  let result = text;
  const sorted = [...candidates].sort((a, b) => b.name.length - a.name.length);
  for (const c of sorted) {
    const re = new RegExp(`(^|\\s)@${escapeRegExp(c.name)}(?=$|\\s|[.,!?;:])`, "g");
    result = result.replace(re, (_, pre) => `${pre}@[${c.name}](${c.id})`);
  }
  return result;
}

function renderContent(content, selfId) {
  if (!content) return null;
  const nodes = [];
  let lastIndex = 0;
  const re = new RegExp(MENTION_RE);
  let match;
  while ((match = re.exec(content))) {
    if (match.index > lastIndex) nodes.push(...renderLinks(content.slice(lastIndex, match.index), lastIndex));
    nodes.push(
      <span
        key={match.index}
        className={`rounded px-1 font-medium ${
          match[2] === selfId ? "bg-amber-200/70 text-amber-900 dark:bg-amber-500/15 dark:text-amber-400" : "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
        }`}
      >
        @{match[1]}
      </span>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < content.length) nodes.push(...renderLinks(content.slice(lastIndex), lastIndex));
  return nodes;
}

function renderLinks(text, offset) {
  const nodes = [];
  const re = /https?:\/\/[^\s<>]+/gi;
  let lastIndex = 0;
  for (const match of text.matchAll(re)) {
    const url = match[0].replace(/[.,!?;:]+$/, "");
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    nodes.push(<a key={`link-${offset + match.index}`} href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">{url}</a>);
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// One-line stand-in for a message in the delete confirmation.
function messageSummary(message) {
  const text = (message.content || "").replace(MENTION_RE, "@$1").trim();
  if (text) return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  return message.attachment?.name || "";
}

function AttachmentIcon({ mimeType, className }) {
  if (!mimeType) return <FileIcon className={className} />;
  if (mimeType.startsWith("video/")) return <Film className={className} />;
  if (mimeType.startsWith("image/")) return <ImageIcon className={className} />;
  if (mimeType.startsWith("audio/")) return <Music className={className} />;
  if (DOCUMENT_MIME_TYPES.has(mimeType)) return <FileText className={className} />;
  return <FileIcon className={className} />;
}

// The message list + composer for one conversation. Shared by the global
// Messages page and each workspace's own Chat section.
// headerStart sits before the conversation name: the phone layouts put
// their way back to the conversation list there.
export default function ChatThread({ conversation, headerStart, headerExtra, targetMessageId }) {
  const [replyTo, setReplyTo] = useState(null), [pinsOnly, setPinsOnly] = useState(false);
  const roomy = useMediaQuery("(min-width: 640px)");
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const { workspaces } = useWorkspaces();
  const confirm = useConfirm();
  const openProfile = useMemberProfile();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(() => readChatDraft(user.id, conversation.id));
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingExpiry = useRef(new Map());
  const [mentionState, setMentionState] = useState(null); // { start, end, query } | null
  const [mentionHighlight, setMentionHighlight] = useState(0);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [attachmentUpload, setAttachmentUpload] = useState(null); // { name, size, progress } | null
  const [attachError, setAttachError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [sendError, setSendError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [status, setStatus] = useState("");
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const olderBusy = useRef(false);
  const historyRequest = useRef(0);
  const [retry, setRetry] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchQueryRef = useRef("");
  searchQueryRef.current = searchQuery;
  const [membersOpen, setMembersOpen] = useState(false);
  const [newMessages, setNewMessages] = useState(0);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const nearBottom = useRef(true);
  const prependAnchor = useRef(null);
  const knownMessages = useRef(new Set());
  const uploadRequest = useRef(0);
  const uploadBusy = useRef(false);
  const [sending, setSending] = useState(false);
  const sendRequestRef = useRef(0);
  const sendingRef = useRef(false);
  const [previewing, setPreviewing] = useState(null); // { assetId, version } | null
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState(null); // messageId | null
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeout = useRef(null);
  // Reactions and history prepends preserve the reader's position.
  const shouldScrollToBottom = useRef(true);

  const conversationId = conversation.id;
  const workspaceId = conversation.workspaceId;
  const canAttach = !!workspaceId;
  // Admins, and anyone they gave messages.moderate, can remove anyone's
  // message in the workspace's channels; everyone else only their own. The
  // server enforces the same rule.
  const canModerate = !!workspaceId && can(workspaces.find((w) => w.id === workspaceId), "messages.moderate");
  const mentionCandidates = (conversation.participants || []).filter((p) => p.id !== user.id);
  const filteredMentions = mentionState
    ? mentionCandidates.filter((c) => c.name.toLowerCase().startsWith(mentionState.query.toLowerCase())).slice(0, 6)
    : [];

  function updateDraft(value) {
    setDraft(value);
    setStatus("");
    saveChatDraft(user.id, conversationId, value);
  }

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }, [draft]);

  useLayoutEffect(() => {
    const composer = composerRef.current;
    const shell = composer?.closest(".app-content");
    if (!shell) return;
    const measure = () => {
      shell.style.setProperty("--chat-composer-clearance", `${composer.getBoundingClientRect().height + 12}px`);
      if (nearBottom.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(composer);
    return () => { observer.disconnect(); shell.style.removeProperty("--chat-composer-clearance"); };
  }, []);

  useEffect(() => {
    sendRequestRef.current++;
    sendingRef.current = false;
    setSending(false);
    setSendError("");
    setLoadError("");
    setDraft(readChatDraft(user.id, conversationId));
    setTypingUsers([]);
    setPendingAttachment(null);
    setMentionState(null);
    setReactionPickerFor(null);
    setDeleteError("");
    setAttachError("");
    setActionError("");
    setStatus("");
    setAttachmentUpload(null);
    uploadBusy.current = false;
    return () => {
      sendRequestRef.current++;
      uploadRequest.current++;
      clearTimeout(typingTimeout.current);
      typingExpiry.current.forEach(clearTimeout);
      typingExpiry.current.clear();
      socket?.emit("typing", { conversationId, isTyping: false });
    };
  }, [conversationId, user.id, socket]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const requestId = ++historyRequest.current;
      setLoadingMessages(true);
      setMessages([]);
      knownMessages.current.clear();
      setNextCursor(null);
      setLoadingOlder(false);
      olderBusy.current = false;
      prependAnchor.current = null;
      setNewMessages(0);
      setAwayFromBottom(false);
      nearBottom.current = true;
      socket?.emit("conversation:join", conversationId);
      messagesApi.getMessagePage(conversationId, { q: searchQuery, ...(targetMessageId && !searchQuery ? { around: targetMessageId } : {}), ...(pinsOnly ? { pinned: true } : {}) }).then((page) => {
        if (cancelled || requestId !== historyRequest.current) return;
        shouldScrollToBottom.current = true;
        page.messages.forEach((m) => knownMessages.current.add(m.id));
        setMessages((prev) => mergeMessages(page.messages, prev));
        setNextCursor(page.nextCursor || null);
        setLoadError("");
      }).catch((err) => {
        if (!cancelled && requestId === historyRequest.current) setLoadError(apiErrorMessage(err));
      }).finally(() => {
        if (!cancelled && requestId === historyRequest.current) setLoadingMessages(false);
      });
    };
    load();
    socket?.on("connect", load);
    return () => {
      cancelled = true;
      historyRequest.current++;
      socket?.off("connect", load);
      socket?.emit("conversation:leave", conversationId);
    };
  }, [conversationId, socket, searchQuery, retry, targetMessageId, pinsOnly]);

  useEffect(() => { setReplyTo(null); setPinsOnly(false); }, [conversationId]);
  useEffect(() => {
    if (!socket) return;
    const updated = (message) => { if (message.conversationId === conversationId) setMessages((items) => pinsOnly && !message.isPinned ? items.filter((item) => item.id !== message.id) : items.map((item) => item.id === message.id ? message : item)); };
    socket.on("message:updated", updated);
    return () => socket.off("message:updated", updated);
  }, [socket, conversationId, pinsOnly]);

  useLayoutEffect(() => {
    if (loadingMessages) return;
    const container = scrollRef.current;
    if (prependAnchor.current && container) {
      container.scrollTop = prependAnchor.current.top + container.scrollHeight - prependAnchor.current.height;
      prependAnchor.current = null;
      return;
    }
    if (!shouldScrollToBottom.current) return;
    shouldScrollToBottom.current = false;
    container?.scrollTo({ top: container.scrollHeight });
  }, [messages, loadingMessages]);

  async function loadOlder() {
    if (!nextCursor || olderBusy.current) return;
    olderBusy.current = true;
    setLoadingOlder(true);
    setLoadError("");
    const request = historyRequest.current;
    try {
      const page = await messagesApi.getMessagePage(conversationId, { before: nextCursor, q: searchQuery, ...(pinsOnly ? { pinned: true } : {}) });
      if (request !== historyRequest.current) return;
      const container = scrollRef.current;
      if (container) prependAnchor.current = { top: container.scrollTop, height: container.scrollHeight };
      page.messages.forEach((m) => knownMessages.current.add(m.id));
      setMessages((prev) => mergeMessages(prev, page.messages));
      setNextCursor(page.nextCursor || null);
    } catch (err) {
      if (request === historyRequest.current) setLoadError(apiErrorMessage(err));
    } finally {
      if (request === historyRequest.current) { olderBusy.current = false; setLoadingOlder(false); }
    }
  }

  function jumpToLatest() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    nearBottom.current = true;
    setAwayFromBottom(false);
    setNewMessages(0);
  }

  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg) => {
      if (msg.conversationId !== conversationId) return;
      if (searchQueryRef.current || knownMessages.current.has(msg.id)) return;
      knownMessages.current.add(msg.id);
      shouldScrollToBottom.current = nearBottom.current || msg.sender.id === user.id;
      if (!shouldScrollToBottom.current) setNewMessages((count) => count + 1);
      else { setNewMessages(0); setAwayFromBottom(false); }
      setMessages((prev) => mergeMessages(prev, [msg]));
    };
    const onTyping = ({ conversationId: cid, userId, isTyping }) => {
      if (cid !== conversationId || userId === user.id) return;
      clearTimeout(typingExpiry.current.get(userId));
      setTypingUsers((prev) => isTyping ? [...new Set([...prev, userId])] : prev.filter((id) => id !== userId));
      if (isTyping) typingExpiry.current.set(userId, setTimeout(() => {
        setTypingUsers((prev) => prev.filter((id) => id !== userId));
        typingExpiry.current.delete(userId);
      }, 4000));
      else typingExpiry.current.delete(userId);
    };
    const onReaction = ({ conversationId: cid, messageId, reactions }) => {
      if (cid !== conversationId) return;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    };
    const onDeleted = ({ conversationId: cid, messageId }) => {
      if (cid !== conversationId) return;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setReactionPickerFor((id) => (id === messageId ? null : id));
    };
    socket.on("message:new", onMessage);
    socket.on("typing", onTyping);
    socket.on("message:reaction", onReaction);
    socket.on("message:deleted", onDeleted);
    return () => {
      socket.off("message:new", onMessage);
      socket.off("typing", onTyping);
      socket.off("message:reaction", onReaction);
      socket.off("message:deleted", onDeleted);
    };
  }, [socket, conversationId, user.id]);

  function updateMentionState(value, cursor) {
    const upToCursor = value.slice(0, cursor);
    const match = upToCursor.match(MENTION_TRIGGER_RE);
    if (!match) {
      setMentionState(null);
      return;
    }
    setMentionState({ start: upToCursor.lastIndexOf("@"), end: cursor, query: match[1] });
    setMentionHighlight(0);
  }

  function selectMention(candidate) {
    if (!mentionState) return;
    const insertion = `@${candidate.name} `;
    const nextValue = draft.slice(0, mentionState.start) + insertion + draft.slice(mentionState.end);
    updateDraft(nextValue);
    setMentionState(null);
    const pos = mentionState.start + insertion.length;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  }

  function sendMessage(e) {
    e.preventDefault();
    const trimmed = draft.trim();
    if ((!trimmed && !pendingAttachment) || sendingRef.current || uploadBusy.current) return;
    const content = applyMentions(trimmed, mentionCandidates);
    if (content.length > MESSAGE_LIMIT) {
      setSendError(`Messages can contain up to ${MESSAGE_LIMIT.toLocaleString()} characters, including mentions. Please shorten your message.`);
      return;
    }
    if (!socket?.connected) {
      setSendError("Live connection unavailable. Your draft is still here; try again when connected.");
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setSendError("");
    const requestId = ++sendRequestRef.current;
    const received = (res) => {
        if (requestId !== sendRequestRef.current) return;
        sendingRef.current = false;
        setSending(false);
        if (res?.error || !res?.message) {
          setSendError(res?.error || "Couldn't confirm delivery. Check the conversation before retrying.");
          return;
        }
        if (!searchQueryRef.current) {
          shouldScrollToBottom.current = true;
          knownMessages.current.add(res.message.id);
          setMessages((prev) => mergeMessages(prev, [res.message]));
        } else { setSearchInput(""); setSearchQuery(""); setSearchOpen(false); }
        nearBottom.current = true;
        setNewMessages(0);
        setAwayFromBottom(false);
        updateDraft("");
        setPendingAttachment(null);
        setReplyTo(null);
        setMentionState(null);
        setEmojiPickerOpen(false);
        socket.emit("typing", { conversationId, isTyping: false });
        clearTimeout(typingTimeout.current);
        requestAnimationFrame(() => inputRef.current?.focus());
      };
    if (replyTo) messagesApi.sendMessage(conversationId, { content, attachmentAssetId: pendingAttachment?.assetId, parentMessageId: replyTo.id }).then((message) => received({ message })).catch((err) => received({ error: apiErrorMessage(err) }));
    else socket.emit("message:send", { conversationId, content, attachmentAssetId: pendingAttachment?.assetId }, received);
  }

  function insertEmoji(emoji) {
    if (sendingRef.current) return;
    const el = inputRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const nextValue = draft.slice(0, start) + emoji + draft.slice(end);
    updateDraft(nextValue);
    setEmojiPickerOpen(false);
    const pos = start + emoji.length;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  }

  function toggleReaction(messageId, emoji) {
    setActionError("");
    if (!socket?.connected) { setActionError("Reconnect to add a reaction."); return; }
    setReactionPickerFor(null);
    socket.emit("message:react", { conversationId, messageId, emoji }, (res) => {
      if (res?.error) setActionError(res.error);
    });
  }

  async function deleteMessage(message) {
    setReactionPickerFor(null);
    setDeleteError("");
    const ok = await confirm({
      title: "Delete this message?",
      subject: messageSummary(message),
      message: message.attachment
        ? "It will be removed for everyone in this conversation. The attached file stays in the workspace's Storage."
        : "It will be removed for everyone in this conversation. This can't be undone.",
      confirmLabel: "Delete message",
    });
    if (!ok) return;
    try {
      await messagesApi.deleteMessage(conversationId, message.id);
      // The socket broadcast does this too; doing it here as well means the
      // message goes right away even if that event is slow to arrive.
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
    } catch (err) {
      setDeleteError(apiErrorMessage(err));
    }
  }

  function handleDraftChange(e) {
    const value = e.target.value;
    updateDraft(value);
    updateMentionState(value, e.target.selectionStart);
    if (!socket?.connected) return;
    socket.emit("typing", { conversationId, isTyping: !!value.trim() });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("typing", { conversationId, isTyping: false });
    }, 1500);
  }

  function handleComposerKeyDown(e) {
    if (e.nativeEvent?.isComposing || e.isComposing || e.keyCode === 229) return;
    if (!mentionState || filteredMentions.length === 0 || e.shiftKey) {
      if (e.key === "Enter" && !e.shiftKey) sendMessage(e);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionHighlight((h) => (h + 1) % filteredMentions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionHighlight((h) => (h - 1 + filteredMentions.length) % filteredMentions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      selectMention(filteredMentions[Math.min(mentionHighlight, filteredMentions.length - 1)]);
    } else if (e.key === "Escape") {
      setMentionState(null);
    }
  }

  async function startAttachmentUpload(file) {
    if (!canAttach || !file || uploadBusy.current || sendingRef.current || pendingAttachment) return;
    uploadBusy.current = true;
    const request = ++uploadRequest.current;
    setAttachError("");
    setAttachmentUpload({ name: file.name, size: file.size, progress: 0 });
    try {
      const asset = await assetsApi.uploadChatAttachment(workspaceId, conversationId, file, (evt) => {
        if (request !== uploadRequest.current) return;
        if (!evt.total) return;
        const progress = Math.round((evt.loaded / evt.total) * 100);
        setAttachmentUpload((prev) => (prev ? { ...prev, progress } : prev));
      });
      if (request !== uploadRequest.current) return;
      const latest = asset.latestVersion;
      setPendingAttachment({
        assetId: asset.id,
        versionId: latest.id,
        mimeType: latest.mimeType,
        size: latest.size,
        originalName: latest.originalName,
        name: asset.name,
      });
    } catch (err) {
      if (request === uploadRequest.current) setAttachError(apiErrorMessage(err));
    } finally {
      if (request === uploadRequest.current) { setAttachmentUpload(null); uploadBusy.current = false; }
    }
  }

  function handleThreadDragOver(e) {
    if (!canAttach) return;
    e.preventDefault();
  }

  function handleThreadDrop(e) {
    if (!canAttach) return;
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) startAttachmentUpload(file);
  }

  async function copyMessage(message) {
    setActionError("");
    try {
      await navigator.clipboard.writeText(plainMessage(message.content));
      setStatus("Message copied");
    } catch { setActionError("Couldn't copy the message. Select its text to copy it."); }
  }

  const typingNames = typingUsers.map((id) => conversation.participants?.find((p) => p.id === id)?.name?.split(" ")[0] || "Someone");

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-ink-50 dark:bg-ink-900">
      <div className="flex min-h-[57px] items-center gap-2.5 border-b border-ink-200 bg-white px-3 py-2.5 dark:border-ink-700 dark:bg-ink-800 sm:px-5 sm:py-3">
        {headerStart}
        <button type="button" aria-pressed={pinsOnly} onClick={() => setPinsOnly(!pinsOnly)} className="rounded-lg px-2 py-1 text-xs text-ink-500">{pinsOnly ? "All messages" : "Pinned"}</button>
        {conversation.isMeetingChat ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg brand-mark text-white">
            <MessageSquare className="h-4 w-4" />
          </div>
        ) : conversation.isGroup ? (
          <div
            style={{ backgroundColor: displayColor(conversation.color), color: textOn(conversation.color) }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
          >
            {conversation.title.slice(0, 2).toUpperCase()}
          </div>
        ) : null}
        {!conversation.isGroup && conversation.otherUser ? (
          <button
            type="button"
            onClick={() => openProfile(conversation.otherUser.id)}
            title={`View ${conversation.otherUser.name}'s profile`}
            className="group flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <Avatar name={conversation.otherUser.name} color={conversation.otherUser.avatarColor} src={conversation.otherUser.avatarUrl} size={32} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink-800 group-hover:text-brand-600 dark:text-ink-100 dark:group-hover:text-brand-300">{conversation.title}</span>
              <span className="block text-[11px] text-ink-400">Direct message</span>
            </span>
          </button>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{conversation.title}</p>
            <button type="button" onClick={() => setMembersOpen(true)} className="text-[11px] text-ink-400 hover:text-brand-600 dark:hover:text-brand-300">
              {conversation.participants?.length || 0} {conversation.participants?.length === 1 ? "member" : "members"}
            </button>
          </div>
        )}
        <button type="button" aria-label="Search messages" title="Search messages" aria-expanded={searchOpen} onClick={() => {
          setSearchOpen((open) => !open);
          if (searchOpen) { setSearchInput(""); setSearchQuery(""); }
        }} className={`shrink-0 rounded-lg p-2 ${searchOpen ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" : "text-ink-400 hover:bg-ink-50 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-ink-100"}`}><Search className="h-4 w-4" /></button>
        {headerExtra}
      </div>

      {searchOpen && <div className="flex items-center gap-2 border-b border-ink-200 bg-white px-3 py-2 dark:border-ink-700 dark:bg-ink-800 sm:px-5">
        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-400" />
        <input type="search" aria-label="Search this conversation" placeholder="Search messages and attachments…" value={searchInput} maxLength={200} autoFocus
          onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setSearchOpen(false); setSearchInput(""); setSearchQuery(""); } }}
          className="min-w-0 flex-1 bg-transparent py-1 text-sm text-ink-800 outline-none dark:text-ink-100" />
        <button type="button" aria-label="Close message search" onClick={() => { setSearchOpen(false); setSearchInput(""); setSearchQuery(""); }} className="rounded p-1 text-ink-400 hover:text-ink-700 dark:hover:text-ink-100"><X className="h-4 w-4" /></button>
      </div>}
      {searchQuery && <div className="flex items-center justify-between gap-2 bg-brand-50 px-4 py-2 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
        <span>{loadingMessages ? "Searching…" : `${messages.length}${nextCursor ? "+" : ""} ${messages.length === 1 ? "result" : "results"}`} for “{searchQuery}”</span>
        <button type="button" onClick={() => { setSearchInput(""); setSearchQuery(""); setSearchOpen(false); }} className="shrink-0 font-medium underline">Back to conversation</button>
      </div>}

      <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        role="log"
        aria-label={searchQuery ? "Message search results" : `Messages in ${conversation.title}`}
        aria-live={searchQuery ? "off" : "polite"}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          setAwayFromBottom(!nearBottom.current);
          if (nearBottom.current) setNewMessages(0);
        }}
        onDragOver={handleThreadDragOver}
        onDrop={handleThreadDrop}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-5 [overflow-anchor:none]"
      >
        {!loadingMessages && nextCursor && <div className="flex justify-center">
          <button type="button" onClick={loadOlder} disabled={loadingOlder} className="btn-secondary !rounded-full !px-4 !py-1.5 text-xs">{loadingOlder ? "Loading…" : searchQuery ? "Load more results" : "Load older messages"}</button>
        </div>}
        {loadingMessages ? (
          <Spinner className="py-8" />
        ) : messages.length === 0 ? (
          <EmptyState icon={<MessageCircle className="h-5 w-5" />} title={loadError ? "Couldn't load messages" : searchQuery ? "No matching messages" : "Say hello"} description={loadError ? "Try loading this conversation again." : searchQuery ? "Try another word or a file name." : "Start the conversation with a message."} />
        ) : (
          messages.map((m, i) => {
            const mine = m.sender.id === user.id;
            const previous = messages[i - 1];
            const newDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
            const grouped = !searchQuery && previous && !newDay && previous.sender.id === m.sender.id && new Date(m.createdAt) - new Date(previous.createdAt) < 5 * 60 * 1000;
            const showAvatar = !mine && !grouped;
            const canDelete = mine || canModerate;
            return (
              <Fragment key={m.id}>
              {newDay && <div className="flex items-center gap-3 py-3" role="separator" aria-label={dayLabel(m.createdAt)}>
                <div className="h-px flex-1 bg-ink-200 dark:bg-ink-700" /><span className="text-[11px] font-medium text-ink-400">{dayLabel(m.createdAt)}</span><div className="h-px flex-1 bg-ink-200 dark:bg-ink-700" />
              </div>}
              <div data-message-id={m.id} className={`group flex items-start gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine && (
                  <div className="mt-1 w-7 shrink-0">
                    {showAvatar && (
                      <button
                        type="button"
                        onClick={() => openProfile(m.sender.id, workspaceId)}
                        title={`View ${m.sender.name}'s profile`}
                        className="block rounded-full transition-opacity hover:opacity-80"
                      >
                        <Avatar name={m.sender.name} color={m.sender.avatarColor} src={m.sender.avatarUrl} size={28} />
                      </button>
                    )}
                  </div>
                )}
                <div className="flex min-w-0 max-w-[85%] flex-col sm:max-w-lg">
                  <div
                    tabIndex={0}
                    className={`relative min-w-0 rounded-2xl px-3.5 py-2 text-sm shadow-soft outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 ${
                      mine ? "rounded-br-sm bg-gradient-to-br from-brand-600 to-brand-800 text-white" : "rounded-bl-sm border border-ink-200 bg-white text-ink-800 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
                    }`}
                  >
                    {!mine && conversation.isGroup && !grouped && (
                      <button
                        type="button"
                        onClick={() => openProfile(m.sender.id, workspaceId)}
                        className="mb-0.5 block text-left text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {m.sender.name}
                      </button>
                    )}
                    {m.parentMessage && <p className="mb-1 truncate border-l-2 border-current pl-2 text-xs opacity-70">Reply to {m.parentMessage.sender?.name}: {m.parentMessage.content || "Attachment"}</p>}
                    {m.isPinned && <p className="mb-1 text-[10px] opacity-70">Pinned</p>}
                    {m.content && <p className="whitespace-pre-wrap break-words">{renderContent(m.content, user.id)}</p>}
                    {m.editedAt && <span className="text-[10px] opacity-60">Edited</span>}
                    <MessageActions message={m} userId={user.id} workspaceId={workspaceId} onReply={setReplyTo} onUpdated={(message) => setMessages((items) => pinsOnly && !message.isPinned ? items.filter((item) => item.id !== message.id) : items.map((item) => item.id === message.id ? message : item))} />
                    {m.attachment && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewing({
                            assetId: m.attachment.assetId,
                            version: {
                              id: m.attachment.versionId,
                              mimeType: m.attachment.mimeType,
                              originalName: m.attachment.originalName,
                              size: m.attachment.size,
                            },
                          })
                        }
                        className={`mt-1.5 flex w-full max-w-[15rem] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                          mine ? "border-white/30 bg-white/10 hover:bg-white/20" : "border-ink-200 bg-ink-50 hover:bg-ink-100 dark:border-ink-700 dark:bg-ink-900 dark:hover:bg-ink-700"
                        }`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${mine ? "bg-white/20 text-white" : "bg-white text-ink-500 dark:bg-ink-800"}`}>
                          <AttachmentIcon mimeType={m.attachment.mimeType} className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-xs font-medium ${mine ? "text-white" : "text-ink-700 dark:text-ink-200"}`}>{m.attachment.name}</span>
                          <span className={`block text-[11px] ${mine ? "text-white/70" : "text-ink-400"}`}>{formatSize(m.attachment.size)}</span>
                        </span>
                      </button>
                    )}
                    <p className={`mt-1 text-right text-[10px] ${mine ? "text-white/70" : "text-ink-400"}`}><time dateTime={m.createdAt} title={new Date(m.createdAt).toLocaleString()}>{timeLabel(m.createdAt)}</time></p>
                  </div>

                    <div className={`relative mt-1 flex items-center gap-1 ${mine ? "justify-end" : ""}`}>
                      {m.content && <button type="button" aria-label="Copy message" title="Copy message" onClick={() => copyMessage(m)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-opacity hover:bg-ink-200 hover:text-ink-700 sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 dark:hover:bg-ink-700 dark:hover:text-ink-100"><Copy className="h-3.5 w-3.5" /></button>}
                      <button
                        type="button"
                        onClick={() => {
                          setEmojiPickerOpen(false);
                          setReactionPickerFor((id) => (id === m.id ? null : m.id));
                        }}
                        title="React"
                        aria-label="React to message"
                        className={`flex h-7 w-7 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-400 shadow-soft transition-opacity hover:text-ink-600 sm:h-6 sm:w-6 dark:border-ink-700 dark:bg-ink-800 dark:hover:text-ink-100 ${
                          reactionPickerFor === m.id ? "opacity-100" : "sm:opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                        }`}
                      >
                        <Smile className="h-3.5 w-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deleteMessage(m)}
                          title={mine ? "Delete message" : "Delete message (admin)"}
                          aria-label="Delete message"
                          className={`flex h-7 w-7 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-400 shadow-soft transition-opacity hover:text-red-500 sm:h-6 sm:w-6 dark:border-ink-700 dark:bg-ink-800 dark:hover:text-red-400 ${
                            reactionPickerFor === m.id ? "opacity-100" : "sm:opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
                          }`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {reactionPickerFor === m.id && (
                        <EmojiPicker onSelect={(emoji) => toggleReaction(m.id, emoji)} onClose={() => setReactionPickerFor(null)} />
                      )}
                    </div>

                  {m.reactions?.length > 0 && (
                    <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : ""}`}>
                      {m.reactions.map((r) => {
                        const mineReacted = r.users.some((u) => u.id === user.id);
                        return (
                          <button
                            key={r.emoji}
                            type="button"
                            onClick={() => toggleReaction(m.id, r.emoji)}
                            title={r.users.map((u) => u.name).join(", ")}
                            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs leading-none transition-colors ${
                              mineReacted
                                ? "border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                                : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
                            }`}
                          >
                            <span>{r.emoji}</span>
                            <span className="text-[10px] font-medium">{r.users.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              </Fragment>
            );
          })
        )}
        {!searchQuery && typingNames.length > 0 && <p role="status" className="pl-9 text-xs text-ink-400">{typingNames.slice(0, 2).join(" and ")}{typingNames.length > 2 ? " and others" : ""} {typingNames.length === 1 ? "is" : "are"} typing…</p>}
      </div>
      {!searchQuery && awayFromBottom && <button type="button" onClick={jumpToLatest} className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-medium text-brand-700 shadow-panel dark:border-ink-700 dark:bg-ink-800 dark:text-brand-300">
        <ArrowDown className="h-3.5 w-3.5" />{newMessages ? `${newMessages} new ${newMessages === 1 ? "message" : "messages"}` : "Jump to latest"}
      </button>}
      </div>

      <div ref={composerRef} className="border-t border-ink-200 bg-white p-2.5 dark:border-ink-700 dark:bg-ink-800 sm:p-4">
        {replyTo && <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-brand-500/10 p-2 text-xs"><span className="truncate">Replying to {replyTo.sender.name}: {plainMessage(replyTo.content) || "Attachment"}</span><button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)}>Cancel</button></div>}
        {!connected && <p role="status" className="mb-2 text-xs text-amber-700 dark:text-amber-400">Live connection unavailable. Reconnecting…</p>}
        {sendError && <p role="alert" className="mb-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">{sendError}</p>}
        {loadError && <div role="alert" className="mb-2 flex items-center gap-3 text-xs text-red-600 dark:text-red-400"><span className="flex-1">{loadError}</span><button type="button" className="font-semibold underline" onClick={() => messages.length && nextCursor ? loadOlder() : setRetry((value) => value + 1)}>Retry</button></div>}
        {actionError && <p role="alert" className="mb-2 text-xs text-red-600 dark:text-red-400">{actionError}</p>}
        {attachError && <p className="mb-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">{attachError}</p>}
        {deleteError && <p className="mb-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">{deleteError}</p>}

        {mentionState && filteredMentions.length > 0 && (
          <div className="mb-2 max-h-40 overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-panel dark:border-ink-700 dark:bg-ink-800">
            {filteredMentions.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectMention(c)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === mentionHighlight ? "bg-brand-50 dark:bg-brand-500/15" : "hover:bg-ink-50 dark:hover:bg-ink-700"}`}
              >
                <Avatar name={c.name} color={c.avatarColor} src={c.avatarUrl} size={22} />
                <span className="text-ink-700 dark:text-ink-200">{c.name}</span>
              </button>
            ))}
          </div>
        )}

        {pendingAttachment && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1.5 dark:border-ink-700 dark:bg-ink-900">
            <AttachmentIcon mimeType={pendingAttachment.mimeType} className="h-4 w-4 shrink-0 text-ink-500" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-700 dark:text-ink-200">{pendingAttachment.name}</span>
            <span className="shrink-0 text-[11px] text-ink-400">{formatSize(pendingAttachment.size)}</span>
            <button
              type="button"
              onClick={() => setPendingAttachment(null)}
              disabled={sending}
              className="shrink-0 rounded p-0.5 text-ink-400 hover:bg-ink-200 hover:text-ink-600 dark:hover:bg-ink-600 dark:hover:text-ink-100"
              aria-label="Remove attachment"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={sendMessage} className="flex items-end gap-1 rounded-xl border border-ink-200 bg-ink-50 p-1.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/10 dark:border-ink-600 dark:bg-ink-900 sm:gap-2">
          <button
            type="button"
            onClick={() => canAttach && fileInputRef.current?.click()}
            disabled={!canAttach || !!attachmentUpload || !!pendingAttachment || sending}
            aria-label="Attach a file"
            title={canAttach ? "Attach a supported document or image" : "File sharing is only available in workspace channels"}
            className="btn-ghost shrink-0 !px-2.5 !py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_UPLOAD_TYPES}
            className="hidden"
            onChange={(e) => {
              if (e.target.files[0]) startAttachmentUpload(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setReactionPickerFor(null);
                setEmojiPickerOpen((o) => !o);
              }}
              title="Add emoji"
              aria-label="Add emoji"
              disabled={sending}
              className="btn-ghost !px-2.5 !py-2"
            >
              <Smile className="h-4 w-4" />
            </button>
            {emojiPickerOpen && <EmojiPicker onSelect={insertEmoji} onClose={() => setEmojiPickerOpen(false)} />}
          </div>
          <textarea
            ref={inputRef}
            className="min-h-[36px] min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 text-ink-800 outline-none placeholder:text-ink-400 disabled:opacity-60 dark:text-ink-100"
            aria-label="Message"
            rows={1}
            maxLength={MESSAGE_LIMIT}
            placeholder={roomy ? "Write a message… (@ to mention someone)" : "Message…"}
            value={draft}
            disabled={sending}
            onChange={handleDraftChange}
            onKeyDown={handleComposerKeyDown}
          />
          <button type="submit" className="btn-primary shrink-0 max-sm:!px-3.5" disabled={sending || !!attachmentUpload || (!draft.trim() && !pendingAttachment)}>
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[10px] text-ink-400">
          <span>{roomy ? "Enter to send · Shift+Enter for a new line · @ to mention" : "Shift+Enter for a new line"}</span>
          <span role="status">{status || (draft.length > MESSAGE_LIMIT - 500 ? `${draft.length.toLocaleString()} / ${MESSAGE_LIMIT.toLocaleString()}` : draft ? "Draft saved" : "")}</span>
        </div>
      </div>

      <Modal open={membersOpen} onClose={() => setMembersOpen(false)} title="Conversation members">
        <div className="space-y-1">
          {(conversation.participants || []).map((person) => <button key={person.id} type="button" onClick={() => { setMembersOpen(false); openProfile(person.id, workspaceId); }} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-ink-50 dark:hover:bg-ink-700">
            <Avatar name={person.name} color={person.avatarColor} src={person.avatarUrl} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm text-ink-700 dark:text-ink-200">{person.name}{person.id === user.id ? " (you)" : ""}</span>
            <Users className="h-3.5 w-3.5 text-ink-400" />
          </button>)}
        </div>
      </Modal>

      <PreviewModal
        open={!!previewing}
        onClose={() => setPreviewing(null)}
        workspaceId={workspaceId}
        assetId={previewing?.assetId}
        version={previewing?.version}
        name={previewing?.version?.originalName}
        onDownload={() => assetsApi.downloadVersion(workspaceId, previewing.assetId, previewing.version)}
      />

      <UploadProgressPanel uploads={attachmentUpload ? [{ id: "chat-attachment", ...attachmentUpload }] : []} />
    </div>
  );
}

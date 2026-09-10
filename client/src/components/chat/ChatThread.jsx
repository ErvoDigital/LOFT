import { useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  MessageSquare,
  Paperclip,
  Smile,
  X,
  File as FileIcon,
  Film,
  Image as ImageIcon,
  Music,
  FileText,
} from "lucide-react";
import * as messagesApi from "../../api/messages.js";
import * as assetsApi from "../../api/assets.js";
import { apiErrorMessage } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSocket } from "../../context/SocketContext.jsx";
import Avatar from "../common/Avatar.jsx";
import EmptyState from "../common/EmptyState.jsx";
import Spinner from "../common/Spinner.jsx";
import PreviewModal from "../storage/PreviewModal.jsx";
import UploadProgressPanel from "../storage/UploadProgressPanel.jsx";
import EmojiPicker from "./EmojiPicker.jsx";

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
    if (match.index > lastIndex) nodes.push(content.slice(lastIndex, match.index));
    nodes.push(
      <span
        key={match.index}
        className={`rounded px-1 font-medium ${
          match[2] === selfId ? "bg-amber-200/70 text-amber-900" : "bg-brand-100 text-brand-700"
        }`}
      >
        @{match[1]}
      </span>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < content.length) nodes.push(content.slice(lastIndex));
  return nodes;
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
export default function ChatThread({ conversation, headerExtra }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [typingUser, setTypingUser] = useState(null);
  const [mentionState, setMentionState] = useState(null); // { start, end, query } | null
  const [mentionHighlight, setMentionHighlight] = useState(0);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [attachmentUpload, setAttachmentUpload] = useState(null); // { name, size, progress } | null
  const [attachError, setAttachError] = useState("");
  const [previewing, setPreviewing] = useState(null); // { assetId, version } | null
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeout = useRef(null);

  const conversationId = conversation.id;
  const workspaceId = conversation.workspaceId;
  const canAttach = !!workspaceId;
  const mentionCandidates = (conversation.participants || []).filter((p) => p.id !== user.id);
  const filteredMentions = mentionState
    ? mentionCandidates.filter((c) => c.name.toLowerCase().startsWith(mentionState.query.toLowerCase())).slice(0, 6)
    : [];

  useEffect(() => {
    setLoadingMessages(true);
    setTypingUser(null);
    setPendingAttachment(null);
    setMentionState(null);
    messagesApi.getMessages(conversationId).then((msgs) => {
      setMessages(msgs);
      setLoadingMessages(false);
    });
    socket?.emit("conversation:join", conversationId);
    return () => socket?.emit("conversation:leave", conversationId);
  }, [conversationId, socket]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg) => {
      if (msg.conversationId === conversationId) setMessages((prev) => [...prev, msg]);
    };
    const onTyping = ({ conversationId: cid, userId, isTyping }) => {
      if (cid !== conversationId || userId === user.id) return;
      setTypingUser(isTyping ? userId : null);
    };
    socket.on("message:new", onMessage);
    socket.on("typing", onTyping);
    return () => {
      socket.off("message:new", onMessage);
      socket.off("typing", onTyping);
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
    setDraft(nextValue);
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
    if ((!trimmed && !pendingAttachment) || !socket) return;
    const content = applyMentions(trimmed, mentionCandidates);
    socket.emit(
      "message:send",
      { conversationId, content, attachmentAssetId: pendingAttachment?.assetId },
      (res) => {
        if (res?.error) console.error(res.error);
      }
    );
    setDraft("");
    setPendingAttachment(null);
    setMentionState(null);
    setEmojiPickerOpen(false);
    socket.emit("typing", { conversationId, isTyping: false });
  }

  function insertEmoji(emoji) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const nextValue = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(nextValue);
    setEmojiPickerOpen(false);
    const pos = start + emoji.length;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  }

  function handleDraftChange(e) {
    const value = e.target.value;
    setDraft(value);
    updateMentionState(value, e.target.selectionStart);
    if (!socket) return;
    socket.emit("typing", { conversationId, isTyping: true });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("typing", { conversationId, isTyping: false });
    }, 1500);
  }

  function handleComposerKeyDown(e) {
    if (!mentionState || filteredMentions.length === 0) return;
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
    if (!canAttach || !file || attachmentUpload) return;
    setAttachError("");
    setAttachmentUpload({ name: file.name, size: file.size, progress: 0 });
    try {
      const asset = await assetsApi.uploadChatAttachment(workspaceId, conversationId, file, (evt) => {
        if (!evt.total) return;
        const progress = Math.round((evt.loaded / evt.total) * 100);
        setAttachmentUpload((prev) => (prev ? { ...prev, progress } : prev));
      });
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
      setAttachError(apiErrorMessage(err));
    } finally {
      setAttachmentUpload(null);
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

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-ink-50">
      <div className="flex items-center gap-2.5 border-b border-ink-200 bg-white px-5 py-3">
        {conversation.isMeetingChat ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
            <MessageSquare className="h-4 w-4" />
          </div>
        ) : conversation.isGroup ? (
          <div
            style={{ backgroundColor: conversation.color || "#4F46E5" }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white"
          >
            {conversation.title.slice(0, 2).toUpperCase()}
          </div>
        ) : (
          <Avatar name={conversation.otherUser?.name} color={conversation.otherUser?.avatarColor} size={32} />
        )}
        <p className="flex-1 text-sm font-semibold text-ink-800">{conversation.title}</p>
        {headerExtra}
      </div>

      <div
        ref={scrollRef}
        onDragOver={handleThreadDragOver}
        onDrop={handleThreadDrop}
        className="flex-1 space-y-3 overflow-y-auto p-5"
      >
        {loadingMessages ? (
          <Spinner className="py-8" />
        ) : messages.length === 0 ? (
          <EmptyState icon={<MessageCircle className="h-5 w-5" />} title="Say hello" description="No messages yet in this conversation." />
        ) : (
          messages.map((m, i) => {
            const mine = m.sender.id === user.id;
            const showAvatar = !mine && (i === 0 || messages[i - 1].sender.id !== m.sender.id);
            return (
              <div key={m.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine && <div className="w-7">{showAvatar && <Avatar name={m.sender.name} color={m.sender.avatarColor} size={28} />}</div>}
                <div
                  className={`min-w-0 max-w-md rounded-2xl px-3.5 py-2 text-sm shadow-soft ${
                    mine ? "brand-mark rounded-br-sm text-white" : "rounded-bl-sm border border-ink-200 bg-white text-ink-800"
                  }`}
                >
                  {!mine && conversation.isGroup && <p className="mb-0.5 text-xs font-semibold text-brand-600">{m.sender.name}</p>}
                  {m.content && <p className="whitespace-pre-wrap break-words">{renderContent(m.content, user.id)}</p>}
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
                        mine ? "border-white/30 bg-white/10 hover:bg-white/20" : "border-ink-200 bg-ink-50 hover:bg-ink-100"
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${mine ? "bg-white/20 text-white" : "bg-white text-ink-500"}`}>
                        <AttachmentIcon mimeType={m.attachment.mimeType} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-xs font-medium ${mine ? "text-white" : "text-ink-700"}`}>{m.attachment.name}</span>
                        <span className={`block text-[11px] ${mine ? "text-white/70" : "text-ink-400"}`}>{formatSize(m.attachment.size)}</span>
                      </span>
                    </button>
                  )}
                  <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-white/70" : "text-ink-400"}`}>{timeLabel(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
        {typingUser && <p className="pl-9 text-xs italic text-ink-400">typing…</p>}
      </div>

      <div className="border-t border-ink-200 bg-white p-4">
        {attachError && <p className="mb-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600">{attachError}</p>}

        {mentionState && filteredMentions.length > 0 && (
          <div className="mb-2 max-h-40 overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-panel">
            {filteredMentions.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectMention(c)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === mentionHighlight ? "bg-brand-50" : "hover:bg-ink-50"}`}
              >
                <Avatar name={c.name} color={c.avatarColor} src={c.avatarUrl} size={22} />
                <span className="text-ink-700">{c.name}</span>
              </button>
            ))}
          </div>
        )}

        {pendingAttachment && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1.5">
            <AttachmentIcon mimeType={pendingAttachment.mimeType} className="h-4 w-4 shrink-0 text-ink-500" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-700">{pendingAttachment.name}</span>
            <span className="shrink-0 text-[11px] text-ink-400">{formatSize(pendingAttachment.size)}</span>
            <button
              type="button"
              onClick={() => setPendingAttachment(null)}
              className="shrink-0 rounded p-0.5 text-ink-400 hover:bg-ink-200 hover:text-ink-600"
              aria-label="Remove attachment"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => canAttach && fileInputRef.current?.click()}
            disabled={!canAttach || !!attachmentUpload}
            title={canAttach ? "Attach a file or video" : "File sharing is only available in workspace channels"}
            className="btn-ghost !px-2.5 !py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              if (e.target.files[0]) startAttachmentUpload(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => setEmojiPickerOpen((o) => !o)}
              title="Add emoji"
              className="btn-ghost !px-2.5 !py-2"
            >
              <Smile className="h-4 w-4" />
            </button>
            {emojiPickerOpen && <EmojiPicker onSelect={insertEmoji} onClose={() => setEmojiPickerOpen(false)} />}
          </div>
          <input
            ref={inputRef}
            className="input"
            placeholder="Write a message… (@ to mention someone)"
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={handleComposerKeyDown}
          />
          <button type="submit" className="btn-primary" disabled={!draft.trim() && !pendingAttachment}>
            Send
          </button>
        </form>
      </div>

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

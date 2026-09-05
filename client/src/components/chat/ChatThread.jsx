import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import * as messagesApi from "../../api/messages.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSocket } from "../../context/SocketContext.jsx";
import Avatar from "../common/Avatar.jsx";
import EmptyState from "../common/EmptyState.jsx";
import Spinner from "../common/Spinner.jsx";

function timeLabel(date) {
  return new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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
  const scrollRef = useRef(null);
  const typingTimeout = useRef(null);

  const conversationId = conversation.id;

  useEffect(() => {
    setLoadingMessages(true);
    setTypingUser(null);
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

  function sendMessage(e) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !socket) return;
    socket.emit("message:send", { conversationId, content }, (res) => {
      if (res?.error) console.error(res.error);
    });
    setDraft("");
    socket.emit("typing", { conversationId, isTyping: false });
  }

  function handleTyping(value) {
    setDraft(value);
    if (!socket) return;
    socket.emit("typing", { conversationId, isTyping: true });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("typing", { conversationId, isTyping: false });
    }, 1500);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-ink-50">
      <div className="flex items-center gap-2.5 border-b border-ink-200 bg-white px-5 py-3">
        {conversation.isGroup ? (
          <div
            style={{ backgroundColor: conversation.color }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold text-white"
          >
            {conversation.title.slice(0, 2).toUpperCase()}
          </div>
        ) : (
          <Avatar name={conversation.otherUser?.name} color={conversation.otherUser?.avatarColor} size={32} />
        )}
        <p className="flex-1 text-sm font-semibold text-ink-800">{conversation.title}</p>
        {headerExtra}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
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
                <div className="w-7">{showAvatar && <Avatar name={m.sender.name} color={m.sender.avatarColor} size={28} />}</div>
                <div
                  className={`max-w-md rounded-2xl px-3.5 py-2 text-sm shadow-soft ${
                    mine ? "brand-mark rounded-br-sm text-white" : "rounded-bl-sm border border-ink-200 bg-white text-ink-800"
                  }`}
                >
                  {!mine && conversation.isGroup && <p className="mb-0.5 text-xs font-semibold text-brand-600">{m.sender.name}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-white/70" : "text-ink-400"}`}>{timeLabel(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
        {typingUser && <p className="pl-9 text-xs italic text-ink-400">typing…</p>}
      </div>

      <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-ink-200 bg-white p-4">
        <input className="input" placeholder="Write a message…" value={draft} onChange={(e) => handleTyping(e.target.value)} />
        <button type="submit" className="btn-primary" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

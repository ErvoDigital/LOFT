import { useCallback, useEffect, useState } from "react";
import { MessageSquare, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import * as messagesApi from "../api/messages.js";
import { useSocket } from "../context/SocketContext.jsx";
import Avatar from "../components/common/Avatar.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Spinner from "../components/common/Spinner.jsx";
import NewDmModal from "../components/chat/NewDmModal.jsx";
import ChatThread from "../components/chat/ChatThread.jsx";

const COLLAPSE_KEY = "loft:messages-list-collapsed";

export default function Chat() {
  const { socket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [dmModalOpen, setDmModalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // localStorage unavailable (private mode, etc.) — collapse state just won't persist.
    }
  }, [collapsed]);

  const loadConversations = useCallback(() => {
    messagesApi.listConversations().then((convos) => {
      setConversations(convos);
      setLoadingConvos(false);
      setActiveId((prev) => prev ?? (convos.length > 0 ? convos[0].id : null));
    });
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!socket) return;
    socket.on("message:preview", loadConversations);
    return () => socket.off("message:preview", loadConversations);
  }, [socket, loadConversations]);

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="flex h-full">
      <div
        className={`flex shrink-0 flex-col border-r border-ink-200 bg-white transition-[width] duration-150 ${
          collapsed ? "w-16 items-center" : "w-72"
        }`}
      >
        <div className={`flex items-center border-b border-ink-200 p-4 ${collapsed ? "flex-col gap-2" : "justify-between"}`}>
          {!collapsed && <h2 className="text-sm font-semibold text-ink-800">Messages</h2>}
          <div className={`flex items-center gap-1 ${collapsed ? "flex-col" : ""}`}>
            <button
              onClick={() => setDmModalOpen(true)}
              title="New conversation"
              className={collapsed ? "rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" : "btn-ghost !px-2 !py-1 text-xs"}
            >
              {collapsed ? <Plus className="h-4 w-4" /> : "+ New"}
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? "Expand messages" : "Collapse messages"}
              className="shrink-0 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className={`flex-1 overflow-y-auto ${collapsed ? "flex w-full flex-col items-center gap-1 py-2" : ""}`}>
          {loadingConvos ? (
            <Spinner className="py-8" />
          ) : conversations.length === 0 ? (
            !collapsed && (
              <div className="p-4">
                <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No conversations yet" description="Join a workspace to get a group chat, or start a DM." />
              </div>
            )
          ) : (
            conversations.map((c) => {
              const avatar = c.isGroup ? (
                <div style={{ backgroundColor: c.color }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white">
                  {c.title.slice(0, 2).toUpperCase()}
                </div>
              ) : (
                <Avatar name={c.otherUser?.name} color={c.otherUser?.avatarColor} src={c.otherUser?.avatarUrl} size={36} />
              );
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  title={collapsed ? c.title : undefined}
                  className={`flex items-center hover:bg-ink-50 ${
                    collapsed ? "h-11 w-11 justify-center rounded-lg" : "w-full gap-2.5 px-4 py-3 text-left"
                  } ${activeId === c.id ? "bg-brand-50" : ""}`}
                >
                  {avatar}
                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-800">{c.title}</p>
                      <p className="truncate text-xs text-ink-400">
                        {c.lastMessage
                          ? c.lastMessage.content || (c.lastMessage.attachment ? `📎 ${c.lastMessage.attachment.name}` : "")
                          : c.isGroup
                          ? "Group chat"
                          : "Say hello"}
                      </p>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {!active ? (
        <div className="flex flex-1 items-center justify-center text-ink-400">Select a conversation</div>
      ) : (
        <ChatThread key={active.id} conversation={active} />
      )}

      <NewDmModal
        open={dmModalOpen}
        onClose={() => setDmModalOpen(false)}
        onStarted={(conversationId) => {
          loadConversations();
          setActiveId(conversationId);
        }}
      />
    </div>
  );
}

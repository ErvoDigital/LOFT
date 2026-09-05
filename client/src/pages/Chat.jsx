import { useCallback, useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import * as messagesApi from "../api/messages.js";
import { useSocket } from "../context/SocketContext.jsx";
import Avatar from "../components/common/Avatar.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Spinner from "../components/common/Spinner.jsx";
import NewDmModal from "../components/chat/NewDmModal.jsx";
import ChatThread from "../components/chat/ChatThread.jsx";

export default function Chat() {
  const { socket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [dmModalOpen, setDmModalOpen] = useState(false);

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
      <div className="flex w-72 shrink-0 flex-col border-r border-ink-200 bg-white">
        <div className="flex items-center justify-between border-b border-ink-200 p-4">
          <h2 className="text-sm font-semibold text-ink-800">Messages</h2>
          <button onClick={() => setDmModalOpen(true)} className="btn-ghost !px-2 !py-1 text-xs">
            + New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConvos ? (
            <Spinner className="py-8" />
          ) : conversations.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No conversations yet" description="Join a workspace to get a group chat, or start a DM." />
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-ink-50 ${activeId === c.id ? "bg-brand-50" : ""}`}
              >
                {c.isGroup ? (
                  <div style={{ backgroundColor: c.color }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white">
                    {c.title.slice(0, 2).toUpperCase()}
                  </div>
                ) : (
                  <Avatar name={c.otherUser?.name} color={c.otherUser?.avatarColor} src={c.otherUser?.avatarUrl} size={36} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800">{c.title}</p>
                  <p className="truncate text-xs text-ink-400">
                    {c.lastMessage ? c.lastMessage.content : c.isGroup ? "Group chat" : "Say hello"}
                  </p>
                </div>
              </button>
            ))
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

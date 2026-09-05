import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MessageSquare, Hash, Circle } from "lucide-react";
import * as conversationsApi from "../api/conversations.js";
import * as workspacesApi from "../api/workspaces.js";
import { apiErrorMessage } from "../api/client.js";
import { useSocket } from "../context/SocketContext.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Spinner from "../components/common/Spinner.jsx";
import ChatThread from "../components/chat/ChatThread.jsx";
import NewChannelModal from "../components/chat/NewChannelModal.jsx";

export default function WorkspaceChat() {
  const { workspaceId } = useParams();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState("MEMBER");
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [channelModalOpen, setChannelModalOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([conversationsApi.listWorkspaceConversations(workspaceId), workspacesApi.getWorkspace(workspaceId)])
      .then(([convos, workspace]) => {
        setConversations(convos);
        setMembers(workspace.members);
        setMyRole(workspace.myRole);
        setLoading(false);
        setActiveId((prev) => {
          if (prev && convos.some((c) => c.id === prev)) return prev;
          return convos.find((c) => c.isDefault)?.id ?? convos[0]?.id ?? null;
        });
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, [workspaceId]);

  useEffect(() => {
    setLoading(true);
    setActiveId(null);
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => load();
    socket.on("conversation:created", handler);
    socket.on("conversation:deleted", handler);
    socket.on("message:preview", handler);
    return () => {
      socket.off("conversation:created", handler);
      socket.off("conversation:deleted", handler);
      socket.off("message:preview", handler);
    };
  }, [socket, load]);

  async function deleteChannel(conversationId) {
    if (!confirm("Delete this channel for everyone?")) return;
    try {
      await conversationsApi.deleteWorkspaceConversation(workspaceId, conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setActiveId((prev) => (prev === conversationId ? null : prev));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const active = conversations.find((c) => c.id === activeId);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex w-64 shrink-0 flex-col border-r border-ink-200 bg-white">
        <div className="flex items-center justify-between border-b border-ink-200 p-4">
          <h2 className="text-sm font-semibold text-ink-800">Channels</h2>
          {myRole === "ADMIN" && (
            <button onClick={() => setChannelModalOpen(true)} className="btn-ghost !px-2 !py-1 text-xs">
              + New
            </button>
          )}
        </div>
        {error && <p className="mx-3 mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600">{error}</p>}
        <div className="flex-1 overflow-y-auto py-1">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-ink-50 ${
                activeId === c.id ? "bg-brand-50 font-medium text-brand-700" : "text-ink-600"
              }`}
            >
              {c.isDefault ? <Hash className="h-3.5 w-3.5 text-ink-400" /> : <Circle className="h-2.5 w-2.5 text-ink-400" />}
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>
      </div>

      {!active ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No channel selected" description="Pick a channel to start chatting." />
        </div>
      ) : (
        <ChatThread
          key={active.id}
          conversation={active}
          headerExtra={
            !active.isDefault && myRole === "ADMIN" ? (
              <button onClick={() => deleteChannel(active.id)} className="text-xs font-medium text-red-500 hover:underline">
                Delete channel
              </button>
            ) : null
          }
        />
      )}

      <NewChannelModal
        open={channelModalOpen}
        onClose={() => setChannelModalOpen(false)}
        workspaceId={workspaceId}
        members={members}
        onCreated={(conversation) => {
          setConversations((prev) => [...prev, conversation]);
          setActiveId(conversation.id);
        }}
      />
    </div>
  );
}

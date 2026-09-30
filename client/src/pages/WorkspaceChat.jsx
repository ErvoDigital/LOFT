import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MessageSquare, Hash, Circle, Trash2 } from "lucide-react";
import * as conversationsApi from "../api/conversations.js";
import * as workspacesApi from "../api/workspaces.js";
import { apiErrorMessage } from "../api/client.js";
import { useSocket } from "../context/SocketContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Spinner from "../components/common/Spinner.jsx";
import ChatThread from "../components/chat/ChatThread.jsx";
import NewChannelModal from "../components/chat/NewChannelModal.jsx";
import useMediaQuery, { TWO_PANE } from "../hooks/useMediaQuery.js";

export default function WorkspaceChat() {
  const { workspaceId } = useParams();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState("MEMBER");
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  // Phones show the channel list or one channel. They open straight into the
  // default channel, since most workspaces only ever use that one.
  const twoPane = useMediaQuery(TWO_PANE);
  const [showThread, setShowThread] = useState(true);

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
    setShowThread(true);
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
    const ok = await confirm({
      title: "Delete this channel?",
      subject: conversations.find((c) => c.id === conversationId)?.title,
      message: "The channel and all of its messages will be deleted for everyone. This can't be undone.",
      confirmLabel: "Delete channel",
    });
    if (!ok) return;
    try {
      await conversationsApi.deleteWorkspaceConversation(workspaceId, conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setActiveId((prev) => (prev === conversationId ? null : prev));
      setShowThread(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const active = conversations.find((c) => c.id === activeId);
  const listHidden = !twoPane && showThread && !!active;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div
        className={`flex w-full shrink-0 flex-col border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-800 md:w-64 md:border-r ${
          listHidden ? "hidden" : ""
        }`}
      >
        <div className="flex items-center justify-between border-b border-ink-200 p-4 dark:border-ink-700">
          <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-100">Channels</h2>
          {myRole === "ADMIN" && (
            <button onClick={() => setChannelModalOpen(true)} className="btn-ghost !px-2 !py-1 text-xs">
              + New
            </button>
          )}
        </div>
        {error && <p className="mx-3 mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
        <div className="flex-1 overflow-y-auto py-1">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setActiveId(c.id);
                setShowThread(true);
              }}
              className={`flex min-h-[44px] w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-ink-50 dark:hover:bg-ink-700 md:min-h-0 ${
                activeId === c.id && twoPane ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "text-ink-600 dark:text-ink-300"
              }`}
            >
              {c.isDefault ? <Hash className="h-3.5 w-3.5 text-ink-400" /> : <Circle className="h-2.5 w-2.5 text-ink-400" />}
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>
      </div>

      {!active ? (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No channel selected" description="Pick a channel to start chatting." />
        </div>
      ) : !twoPane && !showThread ? null : (
        <ChatThread
          key={active.id}
          conversation={active}
          headerStart={
            !twoPane && (
              <button
                onClick={() => setShowThread(false)}
                className="btn-secondary -ml-0.5 shrink-0 !gap-1.5 !rounded-lg !px-2.5 !py-1.5 text-xs"
              >
                <Hash className="h-3.5 w-3.5" /> Channels
              </button>
            )
          }
          headerExtra={
            !active.isDefault && myRole === "ADMIN" ? (
              <button
                onClick={() => deleteChannel(active.id)}
                title="Delete channel"
                aria-label="Delete channel"
                className="shrink-0 rounded-lg p-2 text-ink-400 hover:bg-red-50 sm:p-1 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
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
          setShowThread(true);
        }}
      />
    </div>
  );
}

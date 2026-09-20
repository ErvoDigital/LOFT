import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";
import * as messagesApi from "../api/messages.js";
import { apiErrorMessage } from "../api/client.js";
import { useSocket } from "../context/SocketContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useWorkspaces } from "../context/WorkspaceContext.jsx";
import Avatar from "../components/common/Avatar.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Spinner from "../components/common/Spinner.jsx";
import NewDmModal from "../components/chat/NewDmModal.jsx";
import ChatThread from "../components/chat/ChatThread.jsx";
import { displayColor, textOn } from "../lib/colors.js";

const COLLAPSE_KEY = "loft:messages-list-collapsed";

export default function Chat() {
  const { socket } = useSocket();
  const confirm = useConfirm();
  const { workspaces } = useWorkspaces();
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  // A profile card's "Message" button lands here with the DM to open.
  const [activeId, setActiveId] = useState(() => location.state?.conversationId ?? null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [error, setError] = useState("");
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
      setActiveId((prev) => (prev && convos.some((c) => c.id === prev) ? prev : convos[0]?.id ?? null));
    });
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Already on this page when a profile's "Message" button is used: the route
  // doesn't remount, so pick the new state up here. The state is cleared
  // afterwards so a refresh doesn't keep forcing that conversation open.
  const requestedId = location.state?.conversationId;
  useEffect(() => {
    if (!requestedId) return;
    setActiveId(requestedId);
    loadConversations();
    navigate(location.pathname, { replace: true, state: null });
  }, [requestedId, loadConversations, navigate, location.pathname]);

  useEffect(() => {
    if (!socket) return;
    socket.on("message:preview", loadConversations);
    socket.on("message:deleted", loadConversations);
    socket.on("conversation:deleted", loadConversations);
    return () => {
      socket.off("message:preview", loadConversations);
      socket.off("message:deleted", loadConversations);
      socket.off("conversation:deleted", loadConversations);
    };
  }, [socket, loadConversations]);

  // Deleting a chat here is about your own list, not the chat itself — so the
  // dialog offers wiping the messages for everyone as a separate, unticked
  // box, and only where you're actually allowed to (your own DMs, or a
  // workspace channel you administer; never the General channel).
  async function deleteConversation(conversation) {
    const workspace = conversation.isGroup ? workspaces.find((w) => w.id === conversation.workspaceId) : null;
    const canPurge = conversation.isGroup ? !conversation.isDefault && workspace?.myRole === "ADMIN" : true;

    const ok = await confirm({
      title: "Delete this chat?",
      subject: conversation.title,
      message: conversation.isGroup
        ? "It disappears from your Messages. You stay in the chat, and it comes back if someone posts."
        : `It disappears from your Messages. ${conversation.otherUser?.name || "They"} still has it, and it comes back if they write.`,
      confirmLabel: "Remove from my list",
      option: canPurge
        ? {
            label: "Also delete the messages for everyone",
            description: conversation.isGroup
              ? "Deletes this channel and its whole history for every member. This can't be undone."
              : "Deletes the conversation and its whole history for both of you. This can't be undone.",
            confirmLabel: "Delete for everyone",
          }
        : undefined,
    });
    if (!ok) return;
    setError("");
    try {
      await messagesApi.deleteConversation(conversation.id, { purge: !!ok.option });
      const remaining = conversations.filter((c) => c.id !== conversation.id);
      setConversations(remaining);
      setActiveId((id) => (id === conversation.id ? remaining[0]?.id ?? null : id));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="flex h-full">
      <div
        className={`flex shrink-0 flex-col border-r border-ink-200 bg-white transition-[width] duration-150 dark:border-ink-700 dark:bg-ink-800 ${
          collapsed ? "w-16 items-center" : "w-72"
        }`}
      >
        <div className={`flex items-center border-b border-ink-200 p-4 dark:border-ink-700 ${collapsed ? "flex-col gap-2" : "justify-between"}`}>
          {!collapsed && <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-100">Messages</h2>}
          <div className={`flex items-center gap-1 ${collapsed ? "flex-col" : ""}`}>
            <button
              onClick={() => setDmModalOpen(true)}
              title="New conversation"
              className={collapsed ? "rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-ink-100" : "btn-ghost !px-2 !py-1 text-xs"}
            >
              {collapsed ? <Plus className="h-4 w-4" /> : "+ New"}
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? "Expand messages" : "Collapse messages"}
              className="shrink-0 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-ink-100"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {error && !collapsed && (
          <p className="mx-3 mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>
        )}
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
                <div style={{ backgroundColor: displayColor(c.color), color: textOn(c.color) }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">
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
                  className={`flex items-center hover:bg-ink-50 dark:hover:bg-ink-700 ${
                    collapsed ? "h-11 w-11 justify-center rounded-lg" : "w-full gap-2.5 px-4 py-3 text-left"
                  } ${activeId === c.id ? "bg-brand-50 dark:bg-brand-500/15" : ""}`}
                >
                  {avatar}
                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{c.title}</p>
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
        <ChatThread
          key={active.id}
          conversation={active}
          headerExtra={
            <button
              onClick={() => deleteConversation(active)}
              title="Delete chat"
              aria-label="Delete chat"
              className="shrink-0 rounded-lg p-1 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          }
        />
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

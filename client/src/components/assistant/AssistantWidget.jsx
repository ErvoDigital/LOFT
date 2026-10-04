import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Layers, Sparkles, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";
import WorkspaceMark from "../common/WorkspaceMark.jsx";
import { assistantStatus, sendAssistantMessage, confirmAssistantAction } from "../../api/assistant.js";
import { apiErrorMessage } from "../../api/client.js";

// Supported by the LOFT tools exposed to the OpenClaw gateway.
const SUGGESTIONS = [
  "What do I need to do today?",
  "What should I work on first?",
  "Add a task to finish the presentation tomorrow",
  "Schedule a meeting with my team Friday at 10",
];

const PRIORITY_NAMES = { TIER_1: "Critical", TIER_2: "Time-sensitive", TIER_3: "Flexible", TIER_4: "Backlog" };

// Chat composers and the meeting controls run along the bottom edge and put
// a button in the right corner, so on those pages the launcher sits higher.
const hasBottomControls = (pathname) => /\/(chat|meeting)$/.test(pathname);

let nextId = 0;

// Conversation history stays in memory; tools and confirmations run on the server.
export default function AssistantWidget() {
  const { user } = useAuth();
  const { workspaces } = useWorkspaces();
  const { workspaceId } = useParams();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const launcherRef = useRef(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const requestRef = useRef(null);
  const contextVersion = useRef(0);
  const [configured, setConfigured] = useState(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(null);

  const workspace = workspaces.find((w) => w.id === workspaceId);
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const raised = hasBottomControls(pathname);

  useEffect(() => {
    contextVersion.current++;
    requestRef.current?.abort();
    setMessages([]);
    setDraft("");
    setThinking(false);
    setError("");
    setConfirming(null);
    return () => { contextVersion.current++; requestRef.current?.abort(); };
  }, [workspaceId, user?.id]);

  useEffect(() => {
    if (!open) return;
    let current = true;
    assistantStatus().then((status) => { if (current) setConfigured(status.configured); }).catch(() => { if (current) { setConfigured(null); setError("Could not check assistant setup. Close and reopen to retry."); } });
    return () => { current = false; };
  }, [open]);

  // Focus goes to the composer on open and back to the launcher on close.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      launcherRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking, open]);

  async function send(text) {
    const content = text.trim();
    if (!content || thinking || confirming || !configured) return;
    const version = contextVersion.current;
    const controller = new AbortController();
    requestRef.current = controller;
    setError("");
    const history = messages.filter((m) => !m.failed).slice(-12).map(({ role, content }) => ({ role, content: content.slice(0, 6000) }));
    const messageId = ++nextId;
    setMessages((m) => [...m, { id: messageId, role: "user", content }]);
    setDraft("");
    setThinking(true);
    try {
      const result = await sendAssistantMessage({ message: content, history, ...(workspaceId ? { workspaceId } : {}), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Manila" }, controller.signal);
      if (version === contextVersion.current) setMessages((m) => [...m, { id: ++nextId, role: "assistant", content: result.reply, actions: result.actions }]);
    } catch (err) {
      if (!controller.signal.aborted && version === contextVersion.current) {
        setError(apiErrorMessage(err));
        setMessages((m) => m.map((item) => item.id === messageId ? { ...item, failed: true } : item));
        setDraft(content);
      }
    } finally { if (version === contextVersion.current) setThinking(false); }
  }

  async function confirm(action) {
    if (confirming || thinking) return;
    const version = contextVersion.current;
    setConfirming(action.id);
    setError("");
    try {
      const result = await confirmAssistantAction(action.token);
      if (version === contextVersion.current) setMessages((m) => m.map((item) => ({ ...item, actions: item.actions?.map((a) => a.id === action.id ? { ...a, result } : a) })));
    } catch (err) { if (version === contextVersion.current) setError(apiErrorMessage(err)); }
    finally { if (version === contextVersion.current) setConfirming(null); }
  }

  function dismiss(actionId) {
    setMessages((m) => m.map((item) => ({ ...item, actions: item.actions?.map((a) => a.id === actionId ? { ...a, dismissed: true } : a) })));
  }

  return (
    <div className="print:hidden">
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open LOFT Assistant"
        aria-expanded={open}
        aria-controls="loft-assistant"
        title="LOFT Assistant"
        className={`brand-mark absolute right-3 z-30 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-glow ring-1 ring-white/20 transition-[transform,opacity,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:right-5 sm:h-14 sm:w-14 ${
          raised ? "bottom-[4.75rem] sm:bottom-24" : "bottom-3 sm:bottom-5"
        } ${open ? "invisible scale-75 opacity-0" : ""}`}
      >
        <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>

      {open && (
        <>
          {/* Phones get a modal sheet; wider screens keep the page usable
              beside a floating panel, so the scrim is phone-only. */}
          <div
            onClick={() => setOpen(false)}
            aria-hidden="true"
            className="absolute inset-0 z-40 animate-fade-in bg-ink-950/50 backdrop-blur-sm dark:bg-ink-950/70 sm:hidden"
          />
          <section
            id="loft-assistant"
            role="dialog"
            aria-label="LOFT Assistant"
            className="dropdown-panel assistant-wash absolute inset-x-0 bottom-0 z-40 flex h-[88%] animate-sheet-up flex-col overflow-hidden rounded-b-none sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(38rem,calc(100%-2.5rem))] sm:w-[24rem] sm:animate-slide-fade-in sm:rounded-b-2xl"
          >
            <header className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-4">
              <div className="brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-glow-sm">
                <Sparkles className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">LOFT Assistant</h2>
                <p className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" />
                  {configured === null ? "Checking setup" : configured ? "Ready to ask" : "Setup needed"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-500 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-900 dark:text-ink-400 dark:hover:bg-white/[0.08] dark:hover:text-ink-50"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </header>

            {/* Which workspace the assistant would work in: the one being
                viewed, or all of the user's workspaces everywhere else. */}
            <div className="flex shrink-0 items-center gap-2 border-b border-ink-900/[0.06] px-4 pb-3 dark:border-white/[0.06]">
              <span className="text-xs text-ink-400 dark:text-ink-500">Context</span>
              <span className="chip min-w-0">
                {workspace ? (
                  <WorkspaceMark
                    name={workspace.name}
                    color={workspace.color}
                    logoUrl={workspace.logoUrl}
                    className="h-4 w-4 rounded text-[8px]"
                  />
                ) : (
                  <Layers className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
                )}
                <span className="truncate">{workspace ? workspace.name : "All your workspaces"}</span>
              </span>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">
                  Hi{firstName ? ` ${firstName}` : ""}, I'm your LOFT assistant.
                </p>
                <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">
                  I can help you plan from your tasks and events, and prepare tasks and meetings for you to confirm.
                  {messages.length === 0 && " Try one of these:"}
                </p>
              </div>

              {messages.length === 0 && (
                <div className="space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      disabled={!configured || thinking || Boolean(confirming)}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-ink-200 bg-white/70 px-3 py-2.5 text-left text-sm text-ink-700 transition-colors hover:border-brand-400/60 hover:bg-brand-500/[0.06] hover:text-ink-900 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-200 dark:hover:border-brand-400/30 dark:hover:bg-brand-500/10 dark:hover:text-ink-50"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className="space-y-2">
                <div className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-soft ${
                      m.role === "user"
                        ? "rounded-br-sm bg-gradient-to-br from-brand-600 to-brand-800 text-white"
                        : "rounded-bl-sm border border-ink-200 bg-white text-ink-800 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
                    }`}
                  >
                    {m.content}
                  </p>
                </div>
                {m.actions?.map((action) => (
                  <div key={action.id} className="rounded-xl border border-ink-200 bg-white p-3 text-sm dark:border-ink-700 dark:bg-ink-800">
                    <p className="font-semibold">{action.kind === "task" ? "Create task" : "Create meeting"}: {action.data.title}</p>
                    <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Workspace: {action.preview?.workspaceName || workspaces.find((w) => w.id === action.data.workspaceId)?.name || action.data.workspaceId}</p>
                    {action.data.description && <p className="mt-1 whitespace-pre-wrap">{action.data.description}</p>}
                    {action.kind === "task" ? <>
                      <p className="mt-1 text-xs">Priority: {PRIORITY_NAMES[action.data.tier]} · Assigned to {action.data.assigneeId === user?.id ? "you" : action.preview?.people?.[0]?.name || action.data.assigneeId}</p>
                      {action.data.dueDate && <p className="mt-1 text-xs">Due: {new Date(action.data.dueDate).toLocaleString()}</p>}
                    </> : <>
                      <p className="mt-1 text-xs">{new Date(action.data.startTime).toLocaleString()} – {new Date(action.data.endTime).toLocaleString()}</p>
                      <p className="mt-1 text-xs">Attendees: {action.preview?.people?.map((p) => p.name).join(", ") || action.data.attendeeIds.join(", ")}</p>
                    </>}
                    {action.result ? <Link className="mt-2 inline-block text-brand-600 underline dark:text-brand-400" to={`/workspaces/${action.result.workspaceId}/${action.kind === "task" ? "tasks" : "calendar"}`}>Saved — open {action.kind === "task" ? "task board" : "calendar"}</Link>
                      : action.dismissed ? <p className="mt-2 text-xs">Dismissed</p>
                      : <div className="mt-3 flex gap-2"><button type="button" className="btn-primary" onClick={() => confirm(action)} disabled={Boolean(confirming) || thinking}>{confirming === action.id ? "Saving…" : "Confirm"}</button><button type="button" className="btn-secondary" onClick={() => dismiss(action.id)} disabled={Boolean(confirming)}>Dismiss</button></div>}
                  </div>
                ))}
                </div>
              ))}

              {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

              {thinking && (
                <div
                  role="status"
                  className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm border border-ink-200 bg-white px-3.5 py-3 dark:border-ink-700 dark:bg-ink-800"
                >
                  <span className="sr-only">Assistant is thinking</span>
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      style={{ animationDelay: `${delay}ms` }}
                      className="h-1.5 w-1.5 rounded-full bg-brand-500 motion-safe:animate-pulse"
                    />
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="shrink-0 border-t border-ink-900/[0.06] px-3 pb-3 pt-3 dark:border-white/[0.06]"
            >
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  className="input min-w-0"
                  placeholder="Ask LOFT anything…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="Message the assistant"
                  maxLength={4000}
                />
                <button type="submit" className="btn-primary shrink-0" disabled={!draft.trim() || thinking || Boolean(confirming) || !configured}>
                  Send
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-ink-400 dark:text-ink-500">
                {configured ? "Check suggestions before confirming. Chat clears when you change workspace or reload." : "Your team needs to finish assistant setup before you can send messages."}
              </p>
            </form>
          </section>
        </>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Layers, Mic, Sparkles, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";
import WorkspaceMark from "../common/WorkspaceMark.jsx";
import VoiceAssistant from "./VoiceAssistant.jsx";
import { createAssistantAudio } from "../../utils/assistantAudio.js";
import { assistantStatus, sendAssistantMessage, confirmAssistantAction, speakAssistantReply, transcribeAssistantAudio } from "../../api/assistant.js";
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
const MAX_RECORDING_MS = 30000;
const NO_SPEECH = "I didn't catch that. Hold M and try again.";

// Conversation history stays in memory; tools and confirmations run on the server.
export default function AssistantWidget() {
  const { user } = useAuth();
  const { workspaces } = useWorkspaces();
  const { workspaceId } = useParams();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [draft, setDraft] = useState("");
  const [pendingReplyMode, setPendingReplyMode] = useState(null);
  const thinking = pendingReplyMode !== null;
  const launcherRef = useRef(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const requestRef = useRef(null);
  const transcribeRef = useRef(null);
  const ttsRef = useRef(null);
  const playbackRef = useRef(null);
  const audioContextRef = useRef(null);
  const voiceAudioRef = useRef(new Map());
  const [playingReplyId, setPlayingReplyId] = useState(null);
  const recorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const contextVersion = useRef(0);
  const [configured, setConfigured] = useState(null);
  const [error, setError] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [confirming, setConfirming] = useState(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const voiceEnabledRef = useRef(false);
  const voiceSessionRef = useRef(0);
  // The hold-M voice bubble: { fromId, holding } while it's up. Messages
  // with ids above fromId are its current turn.
  const [bubble, setBubble] = useState(null);
  const bubbleHolding = useRef(false);

  const workspace = workspaces.find((w) => w.id === workspaceId);
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const raised = hasBottomControls(pathname);

  useEffect(() => {
    contextVersion.current++;
    requestRef.current?.abort();
    transcribeRef.current?.abort();
    ttsRef.current?.controller.abort();
    playbackRef.current?.pause();
    playbackRef.current = null;
    for (const { url } of voiceAudioRef.current.values()) if (url) URL.revokeObjectURL(url);
    voiceAudioRef.current.clear();
    setPlayingReplyId(null);
    voiceEnabledRef.current = false;
    clearTimeout(recordingTimeoutRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    mediaStreamRef.current = null;
    setMessages([]);
    setDraft("");
    setPendingReplyMode(null);
    setRecording(false);
    setTranscribing(false);
    setError("");
    setVoiceError("");
    setConfirming(null);
    setBubble(null);
    bubbleHolding.current = false;
    return () => {
      contextVersion.current++;
      requestRef.current?.abort();
      transcribeRef.current?.abort();
      ttsRef.current?.controller.abort();
      playbackRef.current?.pause();
      playbackRef.current = null;
      for (const { url } of voiceAudioRef.current.values()) if (url) URL.revokeObjectURL(url);
      voiceAudioRef.current.clear();
      audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
      clearTimeout(recordingTimeoutRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      mediaStreamRef.current = null;
    };
  }, [workspaceId, user?.id]);

  // The voice bubble can start a turn without the panel ever opening, so the
  // setup check also runs once up front.
  useEffect(() => {
    let current = true;
    assistantStatus().then((status) => { if (current) setConfigured(status.configured); }).catch(() => {});
    return () => { current = false; };
  }, []);

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

  function stopPlayback() {
    if (ttsRef.current) {
      const { controller, messageId } = ttsRef.current;
      controller.abort();
      updateVoiceReply(messageId, { audioStatus: "canceled" });
    }
    ttsRef.current = null;
    playbackRef.current?.pause();
    playbackRef.current = null;
    setPlayingReplyId(null);
  }

  function updateVoiceReply(messageId, patch) {
    setMessages((items) => items.map((item) => item.id === messageId ? { ...item, ...patch } : item));
  }

  function changeVoiceMode(enabled) {
    voiceSessionRef.current++;
    voiceEnabledRef.current = enabled;
    if (!enabled) {
      stopPlayback();
      transcribeRef.current?.abort();
      stopRecording();
      setTranscribing(false);
    }
  }

  function prepareVoicePlayback() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      audioContextRef.current ||= new AudioContext();
      // Called directly by keydown / Play, before asynchronous work starts.
      return audioContextRef.current.resume().catch(() => {});
    } catch { /* The audio element still offers Play if Web Audio is unavailable. */ }
  }

  async function playGeneratedReply(messageId, { prepare = false } = {}) {
    const version = contextVersion.current;
    const voiceSession = voiceSessionRef.current;
    if (prepare) await prepareVoicePlayback();
    if (!voiceEnabledRef.current || version !== contextVersion.current || voiceSession !== voiceSessionRef.current) return;
    const entry = voiceAudioRef.current.get(messageId);
    if (!entry) return;
    stopPlayback();
    playbackRef.current = entry.audio;
    updateVoiceReply(messageId, { audioError: "" });
    try {
      if (entry.url) entry.audio.currentTime = 0;
      await entry.audio.play();
      if (version === contextVersion.current && playbackRef.current === entry.audio) setPlayingReplyId(messageId);
    } catch (err) {
      if (version !== contextVersion.current || playbackRef.current !== entry.audio) return;
      playbackRef.current = null;
      setPlayingReplyId(null);
      // Keep generated audio available when the browser requires a user click.
      updateVoiceReply(messageId, { audioError: err.name === "NotAllowedError" ? "Audio is ready. Tap Play to listen." : "Could not play the voice reply. Tap Play to try again." });
    }
  }

  async function playReply(text, version, voiceSession, messageId) {
    if (!voiceEnabledRef.current || voiceSession !== voiceSessionRef.current || !text?.trim()) return;
    stopPlayback();
    const controller = new AbortController();
    ttsRef.current = { controller, messageId };
    updateVoiceReply(messageId, { audioStatus: "generating", audioError: "" });
    try {
      const audioBlob = await speakAssistantReply(text, { ...(workspaceId ? { workspaceId } : {}) }, controller.signal);
      if (controller.signal.aborted || !voiceEnabledRef.current || voiceSession !== voiceSessionRef.current || version !== contextVersion.current) return;
      const { audio, url } = await createAssistantAudio(audioBlob, audioContextRef.current);
      if (controller.signal.aborted || !voiceEnabledRef.current || voiceSession !== voiceSessionRef.current || version !== contextVersion.current) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      ttsRef.current = null;
      const previous = voiceAudioRef.current.get(messageId);
      if (previous?.url) URL.revokeObjectURL(previous.url);
      voiceAudioRef.current.set(messageId, { url, audio });
      audio.onended = () => {
        if (playbackRef.current === audio) {
          playbackRef.current = null;
          setPlayingReplyId(null);
        }
      };
      audio.onerror = () => {
        if (version !== contextVersion.current) return;
        if (playbackRef.current === audio) stopPlayback();
        voiceAudioRef.current.delete(messageId);
        if (url) URL.revokeObjectURL(url);
        updateVoiceReply(messageId, { audioStatus: "failed", audioError: "The generated audio could not be played. Try again." });
      };
      updateVoiceReply(messageId, { audioStatus: "ready" });
      await playGeneratedReply(messageId);
    } catch (err) {
      const reportError = !controller.signal.aborted && version === contextVersion.current;
      if (ttsRef.current?.controller === controller) ttsRef.current = null;
      if (reportError) updateVoiceReply(messageId, { audioStatus: "failed", audioError: apiErrorMessage(err) });
    }
  }

  function retryVoiceReply(message) {
    prepareVoicePlayback();
    void playReply(message.content, contextVersion.current, voiceSessionRef.current, message.id);
  }

  // `hold`: started by the voice bubble's hold-M, which may already have been
  // released while the microphone was opening.
  async function beginRecording({ hold = false } = {}) {
    if (!voiceEnabledRef.current || thinking || confirming || transcribing || !configured || recording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Voice input is not supported in this browser.");
      return;
    }
    setVoiceError("");
    stopPlayback();
    const version = contextVersion.current;
    const voiceSession = voiceSessionRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!voiceEnabledRef.current || voiceSession !== voiceSessionRef.current || version !== contextVersion.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStreamRef.current = stream;
      const chunks = [];
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"].find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (recorderRef.current !== recorder) return;
        recorderRef.current = null;
        clearTimeout(recordingTimeoutRef.current);
        mediaStreamRef.current = null;
        setRecording(false);
        if (!voiceEnabledRef.current || voiceSession !== voiceSessionRef.current || !chunks.length || contextVersion.current !== version) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) {
          setVoiceError("No voice audio was captured. Please try again.");
          return;
        }
        setTranscribing(true);
        const controller = new AbortController();
        transcribeRef.current = controller;
        try {
          const result = await transcribeAssistantAudio(blob, { ...(workspaceId ? { workspaceId } : {}) }, controller.signal);
          if (!controller.signal.aborted && voiceEnabledRef.current && voiceSession === voiceSessionRef.current && contextVersion.current === version) {
            setTranscribing(false);
            await send(result.transcript, { voice: true });
          }
        } catch (err) {
          if (!controller.signal.aborted && contextVersion.current === version) setVoiceError(apiErrorMessage(err));
        } finally {
          if (contextVersion.current === version && voiceSession === voiceSessionRef.current) setTranscribing(false);
        }
      };
      recorder.start();
      setRecording(true);
      recordingTimeoutRef.current = setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, MAX_RECORDING_MS);
      if (hold && !bubbleHolding.current) recorder.stop();
    } catch {
      if (!voiceEnabledRef.current || voiceSession !== voiceSessionRef.current || version !== contextVersion.current) return;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setRecording(false);
      setVoiceError("Couldn't access your microphone. Check your browser permissions and try again.");
    }
  }

  function stopRecording() {
    clearTimeout(recordingTimeoutRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    else setRecording(false);
  }

  async function send(text, { voice = false } = {}) {
    const content = text.trim();
    // The recorder callback retains the state from when recording started.
    // Voice submissions already passed the transcription and context checks.
    if (!content || thinking || confirming || (!voice && (transcribing || recording)) || !configured) return;
    // The input feature owns the reply mode; text never generates speech or
    // interrupts a bubble reply that is still generating or playing.
    const version = contextVersion.current;
    const voiceSession = voiceSessionRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    (voice ? setVoiceError : setError)("");
    if (voice) stopPlayback();
    const history = messagesRef.current.filter((m) => !m.failed && !m.streaming).slice(-12).map(({ role, content }) => ({ role, content: content.slice(0, 6000) }));
    const messageId = ++nextId;
    const replyId = ++nextId;
    setMessages((m) => [...m, { id: messageId, role: "user", content, ...(voice ? { voice: true } : {}) }]);
    if (!voice) setDraft("");
    setPendingReplyMode(voice ? "voice" : "text");
    let partialReply = "";
    const showProgress = (event) => {
      if (controller.signal.aborted || version !== contextVersion.current) return;
      partialReply = event.type === "reset" ? "" : partialReply + (event.text || "");
      setMessages((items) => {
        const existing = items.some((item) => item.id === replyId);
        if (!partialReply) return items.filter((item) => item.id !== replyId);
        const reply = { id: replyId, role: "assistant", content: partialReply, replyMode: "text", streaming: true };
        return existing ? items.map((item) => item.id === replyId ? reply : item) : [...items, reply];
      });
    };
    try {
      const result = await sendAssistantMessage({ message: content, interactionMode: voice ? "voice" : "text", history, ...(workspaceId ? { workspaceId } : {}), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Manila" }, controller.signal, voice ? undefined : showProgress);
      if (!controller.signal.aborted && version === contextVersion.current) {
        const reply = { id: replyId, role: "assistant", content: result.reply, actions: result.actions, replyMode: voice ? "voice" : "text", ...(voice ? { audioStatus: "canceled" } : {}) };
        setMessages((m) => [...m.filter((item) => item.id !== replyId), reply]);
        if (voice) void playReply(result.reply, version, voiceSession, replyId);
      }
    } catch (err) {
      if (!controller.signal.aborted && version === contextVersion.current) {
        (voice ? setVoiceError : setError)(apiErrorMessage(err));
        setMessages((m) => m.filter((item) => item.id !== replyId).map((item) => item.id === messageId ? { ...item, failed: true } : item));
        if (!voice) setDraft(content);
      }
    } finally { if (version === contextVersion.current) setPendingReplyMode(null); }
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

  // Voice capture/playback belongs to the bubble; both features share history.
  function startBubbleTurn() {
    // A question already on its way can't be cut off (send() would drop the
    // new one), but a spoken answer can: recording stops the playback.
    if (thinking || transcribing || confirming || recording || bubbleHolding.current) return false;
    setVoiceError("");
    bubbleHolding.current = true;
    setBubble({ fromId: nextId, holding: true });
    if (!configured) {
      setVoiceError(configured === false ? "Your team needs to finish assistant setup before Lofty can answer." : "Lofty is still starting up. Try again in a moment.");
      return true;
    }
    changeVoiceMode(true);
    void beginRecording({ hold: true });
    return true;
  }

  function endBubbleHold() {
    bubbleHolding.current = false;
    setBubble((b) => b && { ...b, holding: false });
    stopRecording();
  }

  // Closing voice stops its devices and pending speech. The synchronized text
  // conversation remains available, including an answer still on its way.
  function closeBubble() {
    if (!bubble) return;
    const asked = messages.some((m) => m.id > bubble.fromId && m.role === "user");
    bubbleHolding.current = false;
    setBubble(null);
    changeVoiceMode(false);
    if (asked) {
      setOpen(true);
    } else {
      setVoiceError("");
    }
  }

  const bubbleTurn = bubble ? messages.filter((m) => m.id > bubble.fromId && (m.voice || m.replyMode === "voice")) : [];
  const bubbleQuestion = bubbleTurn.findLast((m) => m.role === "user");
  const bubbleAnswer = bubbleTurn.findLast((m) => m.role === "assistant");
  const answerPlaying = Boolean(bubbleAnswer) && playingReplyId === bubbleAnswer.id;
  const answerGenerating = bubbleAnswer?.audioStatus === "generating";
  const bubblePhase = bubble?.holding || recording ? "listening"
    : transcribing || pendingReplyMode === "voice" || answerGenerating ? "thinking"
    : answerPlaying ? "speaking"
    : voiceError || bubbleAnswer?.audioError || !bubbleQuestion ? "error"
    : "done";

  return (
    <div className="print:hidden">
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Lofty"
        aria-expanded={open}
        aria-controls="loft-assistant"
        title="Lofty (or hold M to talk)"
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
            aria-label="Lofty"
            className="dropdown-panel assistant-wash absolute inset-x-0 bottom-0 z-40 flex h-[88%] animate-sheet-up flex-col overflow-hidden rounded-b-none sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(38rem,calc(100%-2.5rem))] sm:w-[24rem] sm:animate-slide-fade-in sm:rounded-b-2xl"
          >
            <header className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-4">
              <div className="brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-glow-sm">
                <Sparkles className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Lofty</h2>
                <p className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" />
                  {configured === null ? "Checking setup" : configured ? "Ready to ask" : "Setup needed"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Lofty"
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
                  Hi{firstName ? ` ${firstName}` : ""}, I'm Lofty, your LOFT workspace assistant.
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
                    {m.voice && <Mic className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px opacity-80" aria-hidden="true" />}
                    {m.content}
                  </p>
                </div>
                {m.actions?.map((action) => (
                  <div key={action.id} className="rounded-xl border border-ink-200 bg-white p-3 text-sm dark:border-ink-700 dark:bg-ink-800">
                    <p className="font-semibold">{action.kind === "task" ? "Create task" : action.kind === "event_draft" ? "Save meeting draft" : "Create meeting"}: {action.data.title}</p>
                    <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Workspace: {action.preview?.workspaceName || workspaces.find((w) => w.id === action.data.workspaceId)?.name || action.data.workspaceId}</p>
                    {action.data.description && <p className="mt-1 whitespace-pre-wrap">{action.data.description}</p>}
                    {action.data.location && <p className="mt-1 text-xs">Location: {action.data.location}</p>}
                    {action.kind === "task" ? <>
                      <p className="mt-1 text-xs">Priority: {PRIORITY_NAMES[action.data.tier]}{action.data.deferredFields?.includes("tier") ? " (default until you edit it)" : ""} · {action.data.assigneeId ? `Assigned to ${action.data.assigneeId === user?.id ? "you" : action.preview?.people?.[0]?.name || action.data.assigneeId}` : "Unassigned"}</p>
                      {action.data.dueDate && <p className="mt-1 text-xs">Due: {new Date(action.data.dueDate).toLocaleString()}</p>}
                    </> : <>
                      <p className="mt-1 text-xs">{action.kind === "event_draft" ? "Unscheduled draft — finish the details in your workspace calendar." : `${new Date(action.data.startTime).toLocaleString()} – ${new Date(action.data.endTime).toLocaleString()}`}</p>
                      {action.kind === "event_draft" && action.data.startTime && <p className="mt-1 text-xs">Proposed start: {new Date(action.data.startTime).toLocaleString()}</p>}
                      {action.kind === "event_draft" && action.data.endTime && <p className="mt-1 text-xs">Proposed end: {new Date(action.data.endTime).toLocaleString()}</p>}
                      <p className="mt-1 text-xs">Attendees: {action.preview?.people?.map((p) => p.name).join(", ") || action.data.attendeeIds?.join(", ") || "To add later"}</p>
                    </>}
                    {action.data.deferredFields?.length > 0 && <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">You can add the remaining details later.</p>}
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
                  <span className="sr-only">Lofty is thinking</span>
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
                  placeholder="Ask Lofty anything…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="Message Lofty"
                  maxLength={4000}
                />
                <button type="submit" className="btn-primary shrink-0" disabled={!draft.trim() || thinking || Boolean(confirming) || transcribing || recording || !configured}>
                  Send
                </button>
              </div>
              <p className="mt-2 text-[11px] text-ink-400 dark:text-ink-500">
                Type for text replies. Hold M outside a text field to talk in the voice bubble.
              </p>
              <p className="mt-2 text-center text-[11px] text-ink-400 dark:text-ink-500">
                {configured ? "Check suggestions before confirming. Chat clears when you change workspace or reload." : "Your team needs to finish assistant setup before you can send messages."}
              </p>
            </form>
          </section>
        </>
      )}

      <VoiceAssistant
        raised={raised}
        active={Boolean(bubble)}
        phase={bubblePhase}
        heard={bubbleQuestion?.content || ""}
        reply={bubbleAnswer?.content || ""}
        replyId={bubbleAnswer?.id}
        audio={bubbleAnswer ? voiceAudioRef.current.get(bubbleAnswer.id)?.audio : null}
        error={voiceError || bubbleAnswer?.audioError || NO_SPEECH}
        audioStatus={bubbleAnswer?.audioStatus}
        pendingActions={bubbleAnswer?.actions?.filter((a) => !a.result && !a.dismissed).length || 0}
        micReady={recording}
        stream={recording ? mediaStreamRef.current : null}
        canSkip={answerPlaying || answerGenerating}
        canPlay={Boolean(bubbleAnswer) && !answerPlaying && !answerGenerating && voiceEnabledRef.current}
        onPrepareAudio={prepareVoicePlayback}
        onPlay={() => {
          if (!bubbleAnswer) return;
          if (bubbleAnswer.audioStatus === "ready") {
            void playGeneratedReply(bubbleAnswer.id, { prepare: true });
          } else retryVoiceReply(bubbleAnswer);
        }}
        onHoldStart={startBubbleTurn}
        onHoldEnd={endBubbleHold}
        onSkip={stopPlayback}
        onClose={closeBubble}
      />
    </div>
  );
}

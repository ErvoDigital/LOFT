import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Sparkles, VolumeX, X } from "lucide-react";

// How long M has to be held before Lofty starts listening, so an accidental
// tap does nothing.
const HOLD_MS = 200;

// Rotations per second of the light inside the orb, by phase. While
// listening, the voice level speeds it up further.
const SPIN = { listening: 0.22, thinking: 0.55, speaking: 0.3, done: 0.08, error: 0.05 };

const STATUS = { listening: "Listening", thinking: "Thinking", speaking: "Answering" };
const PILL_LABEL = { listening: "Listening…", thinking: "Thinking…", speaking: "Answering…", done: "Answer ready", error: "Try again" };

const NON_TEXT_INPUTS = new Set(["button", "checkbox", "color", "file", "image", "radio", "range", "reset", "submit"]);

// M only means "talk" when it wouldn't otherwise type a letter: not in a
// field, the chat composer, or a document.
function isTypingTarget(el) {
  if (!el || el === document.body) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  return el.tagName === "INPUT" && !NON_TEXT_INPUTS.has(el.type);
}

const isTalkKey = (e) => e.key?.toLowerCase() === "m" && !e.ctrlKey && !e.metaKey && !e.altKey;

// The glass bubble. Its layers are styled in index.css (.voice-orb), which
// reads --level and --turn from an ancestor. A span, so the small one can
// sit inside a button.
function VoiceOrb({ state, small }) {
  return (
    <span className={`voice-orb ${small ? "voice-orb-sm" : ""}`} data-state={state} aria-hidden="true">
      <span className="voice-orb-halo" />
      <span className="voice-orb-ring" />
      <span className="voice-orb-ring" />
      <span className="voice-orb-arc" />
      <span className="voice-orb-pulse">
        <span className="voice-orb-body">
          <span className="voice-orb-blob voice-orb-blob-a" />
          <span className="voice-orb-blob voice-orb-blob-b" />
          <span className="voice-orb-blob voice-orb-blob-c" />
          <span className="voice-orb-shine" />
        </span>
      </span>
    </span>
  );
}

function Kbd({ children }) {
  return (
    <kbd className="mx-0.5 rounded-md border border-ink-900/15 bg-white/70 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-ink-700 shadow-soft dark:border-white/15 dark:bg-white/[0.08] dark:text-ink-200">
      {children}
    </kbd>
  );
}

function CornerButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-900/10 bg-white/60 text-ink-600 backdrop-blur-md transition-colors hover:bg-white hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-ink-300 dark:hover:bg-white/[0.12] dark:hover:text-ink-50"
    >
      {children}
    </button>
  );
}

// Measures how loudly the user is speaking into the recorder's stream, 0 to
// 1. It only reads the stream; it never plays the microphone back.
function useMicLevel(stream) {
  const read = useRef(() => 0);
  useEffect(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!stream || !AudioContext) return;
    let context;
    let source;
    try {
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      if (context.state === "suspended") context.resume().catch(() => {});
      const samples = new Float32Array(analyser.fftSize);
      read.current = () => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
        // Room noise sits under about 0.01 RMS and ordinary speech peaks
        // around 0.1 to 0.2.
        return Math.min(1, Math.max(0, (Math.sqrt(sum / samples.length) - 0.01) * 7));
      };
    } catch {
      // The orb just idles when the browser can't measure the stream.
    }
    return () => {
      read.current = () => 0;
      source?.disconnect();
      if (context && context.state !== "closed") context.close().catch(() => {});
    };
  }, [stream]);
  return read;
}

// Push-to-talk for Lofty: holding M anywhere outside a text field brings up
// the orb in the middle of the screen. The recording, transcription, reply
// and spoken audio all belong to AssistantWidget's voice mode; this is the
// full-screen view of one turn, driven by these props:
//
// - phase: listening | thinking | speaking | done | error
// - heard / reply: the turn's transcribed question and Lofty's answer
// - stream: the recorder's microphone stream while listening, for the orb
// - onHoldStart() starts a turn and returns false when Lofty is busy;
//   onHoldEnd() sends what was recorded; onSkip() stops the spoken answer;
//   onClose() ends the bubble (the widget moves the turn into its chat).
//
// The minimize button tucks the turn into a pill above the launcher, where
// it keeps running. `raised` matches the launcher's lifted position on pages
// with bottom controls.
export default function VoiceAssistant({
  raised,
  active,
  phase,
  heard,
  reply,
  error,
  pendingActions,
  micReady,
  stream,
  canSkip,
  onHoldStart,
  onHoldEnd,
  onSkip,
  onClose,
}) {
  const [minimized, setMinimized] = useState(false);
  const holdTimer = useRef(null);
  const holding = useRef(false);
  const motion = useRef({ level: 0, pulse: 0, nextPulse: 0, speed: SPIN.done, turn: 0 });
  const overlayRef = useRef(null);
  const pillRef = useRef(null);
  const readLevel = useMicLevel(phase === "listening" ? stream : null);

  // The window listeners are attached once, so they read the latest props
  // through this ref.
  const latest = useRef(null);
  latest.current = { onHoldStart, onHoldEnd, onClose };

  const overlayOpen = active && !minimized;

  useEffect(() => {
    if (!active) setMinimized(false);
  }, [active]);

  useEffect(() => {
    function onKeyDown(e) {
      if (!isTalkKey(e) || e.repeat || e.isComposing || holdTimer.current || holding.current) return;
      if (isTypingTarget(e.target)) return;
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        if (latest.current.onHoldStart() === false) return;
        holding.current = true;
        setMinimized(false);
      }, HOLD_MS);
    }
    function release() {
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      } else if (holding.current) {
        holding.current = false;
        latest.current.onHoldEnd();
      }
    }
    const onKeyUp = (e) => e.key?.toLowerCase() === "m" && release();
    // Letting go of M after switching windows never reaches the page, so
    // leaving it counts as letting go.
    const onHidden = () => document.visibilityState === "hidden" && release();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", onHidden);
      clearTimeout(holdTimer.current);
    };
  }, []);

  // Focus moves into the overlay while it's up and back where it was after.
  // Escape closes it, captured so a dialog underneath doesn't close too.
  useEffect(() => {
    if (!overlayOpen) return;
    const previous = document.activeElement;
    overlayRef.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      latest.current.onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [overlayOpen]);

  // Drives the orb every frame by writing --level and --turn straight onto
  // the overlay and the pill, which keeps per-frame motion out of React.
  useEffect(() => {
    if (!active) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const m = motion.current;
    let frame;
    let last = performance.now();
    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let target = 0;
      if (phase === "listening") target = readLevel.current();
      else if (phase === "speaking") {
        // The answer plays as an audio file with no word timings, so the
        // orb pulses at a speaking cadence instead.
        if (now >= m.nextPulse) {
          m.pulse = 0.45 + Math.random() * 0.45;
          m.nextPulse = now + 180 + Math.random() * 160;
        }
        target = m.pulse *= 0.9;
      }
      // Quick to swell, slow to settle.
      m.level += (target - m.level) * (target > m.level ? 0.45 : 0.12);
      m.speed += (SPIN[phase] + m.level * 0.4 - m.speed) * 0.04;
      // Wrapping at 10 keeps every blob's rate (1, -1.3, 0.8 turns) on a
      // whole number of rotations, so the wrap is invisible.
      if (!still) m.turn = (m.turn + m.speed * dt) % 10;
      const level = (still ? m.level * 0.4 : m.level).toFixed(3);
      const spin = m.turn.toFixed(4);
      for (const el of [overlayRef.current, pillRef.current]) {
        el?.style.setProperty("--level", level);
        el?.style.setProperty("--turn", spin);
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, phase, readLevel]);

  if (!active) return null;

  function skip() {
    onSkip();
    // The Skip button is about to go away, so focus would otherwise drop to
    // the page.
    overlayRef.current?.focus({ preventScroll: true });
  }

  const finished = phase === "done" || phase === "error";
  const closeLabel = heard ? "Close and continue in chat" : "Close";
  const announcement = phase === "error" ? error : reply && finished ? reply : STATUS[phase];

  const overlay = createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Lofty voice"
      tabIndex={-1}
      className="fixed inset-0 z-[65] flex animate-fade-in flex-col items-center overflow-y-auto overscroll-contain px-4 py-20 focus:outline-none print:hidden"
    >
      {/* Clicking away tucks the turn into the pill rather than ending it. */}
      <div className="voice-scrim fixed inset-0" onClick={() => setMinimized(true)} aria-hidden="true" />

      <div className="fixed right-3 top-3 z-10 flex items-center gap-1.5 sm:right-5 sm:top-5">
        <CornerButton label="Minimize" onClick={() => setMinimized(true)}>
          <Minus className="h-[18px] w-[18px]" />
        </CornerButton>
        <CornerButton label={closeLabel} onClick={onClose}>
          <X className="h-[18px] w-[18px]" />
        </CornerButton>
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {/* Clicks fall through to the scrim everywhere but the answer card,
          whose text stays selectable. my-auto centers the column until an
          answer makes it taller than the screen, then it scrolls. */}
      <div className="pointer-events-none relative my-auto flex w-full max-w-xl flex-col items-center text-center">
        <VoiceOrb state={phase} />

        <div className="mt-12 flex w-full flex-col items-center gap-3">
          {STATUS[phase] && (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
              {STATUS[phase]}
            </p>
          )}

          {heard ? (
            <p
              className={`max-w-lg text-balance font-medium tracking-tight transition-[font-size,color] duration-300 ${
                reply ? "text-lg text-ink-500 dark:text-ink-400" : "text-2xl leading-snug text-ink-900 dark:text-ink-50 sm:text-[1.75rem]"
              }`}
            >
              {heard}
            </p>
          ) : (
            phase === "listening" && (
              <p className="text-2xl font-medium tracking-tight text-ink-400 dark:text-ink-500 sm:text-[1.75rem]">
                {micReady ? "Go ahead, I'm listening" : "Opening the microphone…"}
              </p>
            )
          )}

          {phase === "error" && (
            <p className="max-w-md text-balance text-lg font-medium leading-snug text-ink-800 dark:text-ink-100">{error}</p>
          )}

          {reply && (
            <div className="card pointer-events-auto mt-3 w-full animate-slide-fade-in p-4 text-left sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="brand-mark flex h-6 w-6 items-center justify-center rounded-lg text-white shadow-glow-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-semibold text-ink-900 dark:text-ink-50">Lofty</span>
                {canSkip && (
                  <button
                    type="button"
                    onClick={skip}
                    title="Stop reading the answer aloud"
                    className="-my-1 ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-500 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-ink-400 dark:hover:bg-white/[0.08] dark:hover:text-ink-50"
                  >
                    <VolumeX className="h-3.5 w-3.5" />
                    Skip
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-700 dark:text-ink-200">{reply}</p>
              {pendingActions > 0 && (
                <p className="mt-3 border-t border-ink-900/[0.07] pt-3 text-xs text-ink-500 dark:border-white/[0.06] dark:text-ink-400">
                  Lofty prepared {pendingActions === 1 ? "something" : `${pendingActions} things`} for you to confirm. Close this to
                  review {pendingActions === 1 ? "it" : "them"} in the chat.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="pointer-events-none fixed inset-x-0 bottom-6 px-4 text-center text-xs text-ink-500 dark:text-ink-400">
        {phase === "listening" ? (
          <>
            Release <Kbd>M</Kbd> when you're done
          </>
        ) : (
          <>
            Hold <Kbd>M</Kbd> to ask {finished ? "again" : "something else"} · <Kbd>Esc</Kbd>{" "}
            {heard ? "to continue in chat" : "to close"}
          </>
        )}
      </p>
    </div>,
    document.body
  );

  // Minimized: a pill stacked just above the launcher, in the same corner.
  const pill = (
    <div
      ref={pillRef}
      className={`absolute right-3 z-30 flex animate-slide-fade-in items-center gap-0.5 rounded-full border border-white/60 bg-white/85 p-1 shadow-glass-lg backdrop-blur-xl dark:border-white/[0.08] dark:bg-ink-900/85 sm:right-5 print:hidden ${
        raised ? "bottom-[8.375rem] sm:bottom-[10.25rem]" : "bottom-[4.375rem] sm:bottom-[5.5rem]"
      }`}
    >
      <button
        type="button"
        onClick={() => setMinimized(false)}
        title="Show Lofty voice"
        className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 text-sm font-medium text-ink-800 transition-colors hover:bg-ink-900/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-ink-100 dark:hover:bg-white/[0.06]"
      >
        <VoiceOrb state={phase} small />
        {PILL_LABEL[phase]}
      </button>
      {canSkip && (
        <button
          type="button"
          onClick={onSkip}
          aria-label="Stop reading the answer aloud"
          title="Skip"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-ink-400 dark:hover:bg-white/[0.08] dark:hover:text-ink-50"
        >
          <VolumeX className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        title={closeLabel}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-ink-400 dark:hover:bg-white/[0.08] dark:hover:text-ink-50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  return minimized ? pill : overlay;
}

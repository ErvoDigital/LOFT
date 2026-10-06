import { useEffect, useState } from "react";
import { Mic } from "lucide-react";

const BAR_COUNT = 25;

export default function VoiceRecordingIndicator({ stream, maxDurationMs }) {
  const [signal, setSignal] = useState({ level: 0, seconds: 0, heard: false, available: false, muted: false });

  useEffect(() => {
    let context;
    let source;
    let analyser;
    let samples;
    let disposed = false;
    let smoothedLevel = 0;
    let lastHeard = -Infinity;
    const started = performance.now();
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    // This branch only measures the existing stream; it never plays mic audio.
    try {
      if (AudioContext && stream) {
        context = new AudioContext();
        analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        source = context.createMediaStreamSource(stream);
        source.connect(analyser);
        samples = new Uint8Array(analyser.fftSize);
        if (context.state === "suspended") void context.resume().catch(() => {});
      }
    } catch {
      // Recording still works when the browser cannot provide a live meter.
    }

    const update = () => {
      if (disposed) return;
      const now = performance.now();
      const track = stream?.getAudioTracks()[0];
      const muted = !track || track.muted || !track.enabled || track.readyState === "ended";
      const available = Boolean(analyser && samples && context?.state === "running");
      let rms = 0;
      if (available && !muted) {
        analyser.getByteTimeDomainData(samples);
        for (const sample of samples) rms += ((sample - 128) / 128) ** 2;
        rms = Math.sqrt(rms / samples.length);
      }
      if (rms > 0.012) lastHeard = now;
      const target = Math.min(1, rms * 5);
      smoothedLevel = muted ? 0 : smoothedLevel * 0.35 + target * 0.65;
      setSignal({
        level: smoothedLevel,
        seconds: Math.min(Math.floor((now - started) / 1000), Math.floor(maxDurationMs / 1000)),
        heard: available && !muted && now - lastHeard < 700,
        available,
        muted,
      });
    };
    update();
    const timer = window.setInterval(update, 80);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      source?.disconnect();
      analyser?.disconnect();
      if (context && context.state !== "closed") void context.close().catch(() => {});
    };
  }, [stream, maxDurationMs]);

  const status = signal.muted ? "Microphone not receiving audio" : !signal.available ? "Microphone active" : signal.heard ? "Voice detected" : "Waiting for your voice";
  const duration = Math.floor(maxDurationMs / 1000);

  return (
    <div className="mb-3 rounded-2xl border border-brand-300/60 bg-brand-50/80 p-3 dark:border-brand-500/30 dark:bg-brand-500/10">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
          <Mic className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-900 dark:text-ink-50">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 motion-safe:animate-pulse" aria-hidden="true" />
            Recording
          </p>
          <p role="status" className="mt-0.5 text-[11px] text-ink-600 dark:text-ink-300">{status}</p>
        </div>
        <span aria-label={`${signal.seconds} seconds of ${duration} seconds`} className="shrink-0 font-mono text-xs tabular-nums text-ink-600 dark:text-ink-300">
          0:{String(signal.seconds).padStart(2, "0")} / 0:{String(duration).padStart(2, "0")}
        </span>
      </div>
      <div className="mt-3 flex h-10 items-center justify-center gap-1 rounded-xl bg-white/70 px-3 dark:bg-ink-950/30" aria-hidden="true">
        {Array.from({ length: BAR_COUNT }, (_, index) => {
          const envelope = 0.3 + 0.7 * Math.sin((index / (BAR_COUNT - 1)) * Math.PI);
          return <span
            key={index}
            style={{ height: `${3 + signal.level * 33 * envelope}px` }}
            className={`w-1.5 rounded-full motion-safe:transition-[height,background-color] motion-safe:duration-75 ${signal.heard ? "bg-brand-500 dark:bg-brand-400" : "bg-ink-300 dark:bg-ink-600"}`}
          />;
        })}
      </div>
      <p className="mt-2 text-[11px] text-ink-500 dark:text-ink-400">
        {signal.muted ? "Check your microphone connection or mute switch." : signal.available ? "Speak naturally. Tap stop to ask Lofty." : "Tap stop to ask Lofty. Live audio levels are unavailable."}
      </p>
    </div>
  );
}

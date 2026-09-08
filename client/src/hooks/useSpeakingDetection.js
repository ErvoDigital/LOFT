import { useEffect, useRef, useState } from "react";

// Average byte-frequency level (0-255) above which a stream counts as
// "speaking" — picked empirically to sit above typical mic-idle noise floor
// without requiring someone to shout.
const SPEAKING_THRESHOLD = 15;
// Keeps the highlight on briefly after volume drops below the threshold, so
// it doesn't flicker on/off between words and syllables.
const SILENCE_HOLD_MS = 500;

// Given { id: MediaStream }, returns the Set of ids whose audio track is
// currently loud enough to count as speaking. One shared AudioContext is
// reused for every analyser (each is cheap, but a context per stream isn't),
// and analysers are added/removed only when the stream set actually changes
// rather than rebuilt every render.
export function useSpeakingDetection(streamsById) {
  const [speakingIds, setSpeakingIds] = useState(() => new Set());
  const audioContextRef = useRef(null);
  const analysersRef = useRef(new Map()); // id -> { analyser, source, stream, lastLoud }

  const streamKey = Object.entries(streamsById)
    .map(([id, s]) => `${id}:${s?.id || ""}`)
    .sort()
    .join("|");

  useEffect(() => {
    function getContext() {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      // A context created outside a direct user-gesture callstack (this one
      // is — it's created inside an effect, a tick after the "Join now"
      // click that permitted it) can start "suspended" in stricter browsers,
      // silently reading zero for every analyser forever unless resumed.
      audioContextRef.current.resume().catch(() => {});
      return audioContextRef.current;
    }

    for (const [id, stream] of Object.entries(streamsById)) {
      const existing = analysersRef.current.get(id);
      if (existing?.stream === stream) continue;
      if (existing) existing.source.disconnect();

      if (!stream || stream.getAudioTracks().length === 0) {
        analysersRef.current.delete(id);
        continue;
      }
      const ctx = getContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      analysersRef.current.set(id, { analyser, source, stream, lastLoud: 0 });
    }

    for (const id of Array.from(analysersRef.current.keys())) {
      if (!(id in streamsById)) {
        analysersRef.current.get(id).source.disconnect();
        analysersRef.current.delete(id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamKey]);

  useEffect(() => {
    let rafId;
    const data = new Uint8Array(256);

    function tick() {
      const now = performance.now();
      const next = new Set();
      for (const [id, entry] of analysersRef.current) {
        entry.analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        if (sum / data.length > SPEAKING_THRESHOLD) entry.lastLoud = now;
        if (now - entry.lastLoud < SILENCE_HOLD_MS) next.add(id);
      }
      setSpeakingIds((prev) => {
        if (prev.size === next.size && [...prev].every((id) => next.has(id))) return prev;
        return next;
      });
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    return () => {
      for (const { source } of analysersRef.current.values()) source.disconnect();
      analysersRef.current.clear();
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  return speakingIds;
}

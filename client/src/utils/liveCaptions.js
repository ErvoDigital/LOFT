const SAMPLE_RATE = 16000;
const MAX_SECONDS = 30;
const SNAPSHOT_SECONDS = 2.5;
const MAX_PREVIEWS = 10;
const modules = new WeakMap();

// A MediaRecorder timeslice may omit the container header. Encode an entire
// playable WAV instead, including on Safari where capture normally uses MP4.
export function captionWav(chunks, sampleRate) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const samples = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) { samples.set(chunk, offset); offset += chunk.length; }
  const count = Math.floor(length * SAMPLE_RATE / sampleRate);
  const bytes = new ArrayBuffer(44 + count * 2);
  const view = new DataView(bytes);
  const text = (at, value) => { for (let index = 0; index < value.length; index++) view.setUint8(at + index, value.charCodeAt(index)); };
  text(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true); text(8, "WAVEfmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, count * 2, true);
  // Average source samples instead of dropping them during downsampling.
  for (let index = 0; index < count; index++) {
    const start = Math.floor(index * sampleRate / SAMPLE_RATE);
    const end = Math.min(length, Math.max(start + 1, Math.floor((index + 1) * sampleRate / SAMPLE_RATE)));
    let value = 0;
    for (let cursor = start; cursor < end; cursor++) value += samples[cursor];
    value = Math.max(-1, Math.min(1, value / (end - start)));
    view.setInt16(44 + index * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return new Blob([bytes], { type: "audio/wav" });
}

export function createLiveCaptions({ stream, context, transcribe, onTranscript, onUnavailable, NodeClass = globalThis.AudioWorkletNode }) {
  let stopped = false;
  let source;
  let processor;
  let mute;
  let controller;
  let pending = false;
  let previews = 0;
  let samples = 0;
  let lastSnapshot = 0;
  let hasSpeech = false;
  let chunks = [];

  function stop() {
    stopped = true;
    controller?.abort();
    if (processor) { processor.port.onmessage = null; processor.port.close(); }
    source?.disconnect(); processor?.disconnect(); mute?.disconnect();
    chunks = [];
  }

  function unavailable() {
    if (stopped) return;
    stop();
    onUnavailable();
  }

  async function snapshot() {
    // Never queue audio requests. When the provider is slow, the next request
    // contains the latest complete recording, not stale queued fragments.
    if (stopped || pending || !hasSpeech || previews >= MAX_PREVIEWS || samples - lastSnapshot < context.sampleRate * SNAPSHOT_SECONDS) return;
    pending = true;
    previews++;
    lastSnapshot = samples;
    controller = new AbortController();
    try {
      const result = await transcribe(captionWav(chunks, context.sampleRate), controller.signal);
      if (!stopped && typeof result?.transcript === "string" && result.transcript.trim()) onTranscript(result.transcript);
    } catch {
      // Preview is optional; the completed recording still gets its normal
      // authenticated transcription when the user stops.
      unavailable();
    } finally { pending = false; }
  }

  const ready = (async () => {
    try {
      if (!context?.audioWorklet || !NodeClass || context.sampleRate < SAMPLE_RATE) { unavailable(); return; }
      if (!modules.has(context)) modules.set(context, context.audioWorklet.addModule(new URL("./liveCaptions.worklet.js", import.meta.url)));
      await modules.get(context);
      if (stopped) return;
      if (context.state !== "running") await context.resume();
      if (stopped) return;
      source = context.createMediaStreamSource(stream);
      processor = new NodeClass(context, "loft-live-captions", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      mute = context.createGain();
      mute.gain.value = 0;
      processor.port.onmessage = ({ data }) => {
        if (stopped || !(data instanceof Float32Array) || !data.length) return;
        const room = Math.max(0, Math.floor(context.sampleRate * MAX_SECONDS) - samples);
        if (!room) return;
        const chunk = data.length > room ? data.slice(0, room) : data;
        chunks.push(chunk);
        samples += chunk.length;
        if (!hasSpeech) {
          let power = 0;
          for (const value of chunk) power += value * value;
          hasSpeech = Math.sqrt(power / chunk.length) >= 0.003;
        }
        void snapshot();
      };
      processor.onprocessorerror = unavailable;
      source.connect(processor); processor.connect(mute); mute.connect(context.destination);
    } catch { unavailable(); }
  })();
  return { stop, ready };
}

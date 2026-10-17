import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { captionWav, createLiveCaptions } from "../src/utils/liveCaptions.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function capture(options = {}) {
  let processor;
  let moduleLoads = 0;
  const disconnected = [];
  const node = (name) => ({ connect() {}, disconnect() { disconnected.push(name); } });
  const context = {
    sampleRate: 16000, state: "running", destination: {},
    audioWorklet: { addModule: () => { moduleLoads++; return options.module?.promise || Promise.resolve(); } },
    createMediaStreamSource: () => node("source"),
    createGain: () => ({ ...node("mute"), gain: { value: 1 } }),
  };
  const calls = [];
  const transcripts = [];
  let unavailable = 0;
  const session = createLiveCaptions({
    context: options.context === null ? null : context, stream: options.stream || {},
    RecognitionClass: options.RecognitionClass,
    language: options.language,
    NodeClass: class {
      constructor() { processor = this; this.port = { onmessage: null, close() {} }; }
      connect() {}
      disconnect() { disconnected.push("processor"); }
    },
    transcribe: async (audio, signal) => { calls.push({ audio, signal }); return options.response?.promise || { transcript: "Your words" }; },
    onTranscript: (text) => transcripts.push(text),
    onUnavailable: () => unavailable++,
  });
  const emit = async (seconds, level = 0.1) => {
    processor.port.onmessage?.({ data: new Float32Array(Math.round(seconds * 16000)).fill(level) });
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { session, context, calls, transcripts, disconnected, emit, get moduleLoads() { return moduleLoads; }, get unavailable() { return unavailable; } };
}

function browserRecognition({ startError = false } = {}) {
  const instances = [];
  class Recognition {
    constructor() { this.starts = 0; this.aborts = 0; this.tracks = []; instances.push(this); }
    start(track) { this.starts++; this.tracks.push(track); if (startError) throw new Error("Recognition not supported"); }
    abort() { this.aborts++; }
    result(...phrases) {
      this.onresult?.({ results: phrases.map(([transcript, isFinal = false]) => Object.assign([{ transcript }], { isFinal })) });
    }
  }
  return { RecognitionClass: Recognition, instances };
}

test("Browser captions display interim words immediately and replace guesses without duplicating final phrases", async (t) => {
  const browser = browserRecognition();
  const track = { kind: "audio", readyState: "live" };
  const recording = capture({ ...browser, language: "en-PH", stream: { getAudioTracks: () => [track] } });
  t.after(() => recording.session.stop());
  await recording.session.ready;
  const recognition = browser.instances[0];
  assert.equal(recognition.starts, 1);
  assert.equal(recognition.tracks[0], track);
  assert.equal(recognition.lang, "en-PH");
  assert.equal(recognition.continuous, true);
  assert.equal(recognition.interimResults, true);
  recognition.result(["Schedule"]);
  assert.deepEqual(recording.transcripts, ["Schedule"]);
  recognition.result(["Schedule a meat"]);
  recognition.result(["Schedule a meeting", true], ["tomorrow"]);
  recognition.result(["Schedule a meeting", true], ["tomorrow at ten", true]);
  assert.deepEqual(recording.transcripts, ["Schedule", "Schedule a meat", "Schedule a meeting tomorrow", "Schedule a meeting tomorrow at ten"]);
  await recording.emit(5);
  assert.equal(recording.calls.length, 0);
});

test("Browser recognition resumes after pauses and retains the earlier words in the turn", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const browser = browserRecognition();
  const recording = capture(browser);
  t.after(() => recording.session.stop());
  await recording.session.ready;
  const recognition = browser.instances[0];
  recognition.result(["Add a task", true]);
  recognition.onend();
  t.mock.timers.tick(150);
  assert.equal(recognition.starts, 2);
  recognition.result(["for tomorrow"]);
  recognition.result(["for Friday", true]);
  assert.equal(recording.transcripts.at(-1), "Add a task for Friday");
  recognition.onend();
  recording.session.stop();
  t.mock.timers.tick(1000);
  assert.equal(recognition.starts, 2);
  assert.equal(recognition.aborts, 1);
});

test("A browser service failure falls back to audio captured from the beginning and ignores late browser results", async (t) => {
  const browser = browserRecognition();
  const recording = capture(browser);
  t.after(() => recording.session.stop());
  await recording.session.ready;
  const recognition = browser.instances[0];
  recognition.result(["First words"]);
  await recording.emit(3);
  const lateResult = recognition.onresult;
  recognition.onerror({ error: "network" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(recording.calls.length, 1);
  assert.equal(recording.calls[0].audio.size, 44 + 3 * 32000);
  assert.equal(recording.transcripts.at(-1), "Your words");
  assert.equal(recording.unavailable, 0);
  assert.equal(recognition.aborts, 1);
  lateResult({ results: [[{ transcript: "Late browser text" }]] });
  assert.equal(recording.transcripts.at(-1), "Your words");
  await recording.emit(2.5);
  assert.equal(recording.calls.length, 2);
});

test("Browser captions work without Web Audio and are unavailable only when both methods fail", async (t) => {
  const browser = browserRecognition();
  const recording = capture({ ...browser, context: null });
  t.after(() => recording.session.stop());
  await recording.session.ready;
  assert.equal(recording.unavailable, 0);
  const recognition = browser.instances[0];
  recognition.result(["Live without an AudioWorklet"]);
  assert.deepEqual(recording.transcripts, ["Live without an AudioWorklet"]);
  recognition.onerror({ error: "service-not-allowed" });
  assert.equal(recording.unavailable, 1);
  assert.equal(recognition.aborts, 1);
});

test("Unsupported browser constructors and start failures keep server previews available", async (t) => {
  for (const RecognitionClass of [class { constructor() { throw new Error("Disabled"); } }, browserRecognition({ startError: true }).RecognitionClass]) {
    const recording = capture({ RecognitionClass });
    t.after(() => recording.session.stop());
    await recording.session.ready;
    await recording.emit(2.5);
    assert.deepEqual(recording.transcripts, ["Your words"]);
    assert.equal(recording.unavailable, 0);
  }
});

test("A browser exposing recognition without producing words falls back after captured speech", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const browser = browserRecognition();
  const recording = capture(browser);
  t.after(() => recording.session.stop());
  await recording.session.ready;
  await recording.emit(2.5);
  assert.equal(recording.calls.length, 0);
  t.mock.timers.tick(5000);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(recording.calls.length, 1);
  assert.equal(recording.transcripts.at(-1), "Your words");
  assert.equal(browser.instances[0].aborts, 1);
});

test("Receiving browser words cancels the initial fallback timer and stopping detaches all callbacks", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const browser = browserRecognition();
  const recording = capture(browser);
  t.after(() => recording.session.stop());
  await recording.session.ready;
  await recording.emit(2.5);
  const recognition = browser.instances[0];
  recognition.result(["Already live"]);
  t.mock.timers.tick(5000);
  assert.equal(recording.calls.length, 0);
  assert.equal(recognition.aborts, 0);
  const lateResult = recognition.onresult;
  recording.session.stop();
  lateResult({ results: [[{ transcript: "Late words" }]] });
  assert.deepEqual(recording.transcripts, ["Already live"]);
  assert.equal(recognition.onresult, null);
  assert.equal(recognition.onerror, null);
  assert.equal(recognition.onend, null);
  assert.equal(recognition.aborts, 1);
});

test("Repeated empty browser sessions fall back instead of restarting indefinitely", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const browser = browserRecognition();
  const recording = capture(browser);
  t.after(() => recording.session.stop());
  await recording.session.ready;
  const recognition = browser.instances[0];
  recognition.onerror({ error: "no-speech" });
  recognition.onend();
  t.mock.timers.tick(150);
  assert.equal(recognition.starts, 2);
  recognition.onend();
  await recording.emit(2.5);
  assert.equal(recording.calls.length, 1);
  assert.equal(recognition.aborts, 1);
});

test("Prefixed browser recognition is detected automatically", async (t) => {
  const browser = browserRecognition();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "webkitSpeechRecognition");
  Object.defineProperty(globalThis, "webkitSpeechRecognition", { value: browser.RecognitionClass, configurable: true });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "webkitSpeechRecognition", previous);
    else delete globalThis.webkitSpeechRecognition;
  });
  const recording = capture();
  t.after(() => recording.session.stop());
  await recording.session.ready;
  browser.instances[0].result(["Prefixed browser words"]);
  assert.deepEqual(recording.transcripts, ["Prefixed browser words"]);
});

test("Caption PCM snapshots are complete mono WAV files resampled from phone sample rates", async () => {
  for (const sampleRate of [16000, 44100, 48000]) {
    const blob = captionWav([new Float32Array(sampleRate).fill(0.5)], sampleRate);
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.equal(blob.type, "audio/wav");
    assert.equal(bytes.length, 32044);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.readUInt32LE(4), bytes.length - 8);
    assert.equal(bytes.readUInt16LE(22), 1);
    assert.equal(bytes.readUInt32LE(24), 16000);
    assert.equal(bytes.readUInt32LE(40), 32000);
    assert.equal(bytes.readInt16LE(44), 16384);
  }
});

test("Captions arrive before stop and slow providers receive only one current snapshot at a time", async () => {
  const response = deferred();
  const recording = capture({ response });
  await recording.session.ready;
  await recording.emit(2.5);
  assert.equal(recording.calls.length, 1);
  await recording.emit(3);
  assert.equal(recording.calls.length, 1);
  response.resolve({ transcript: "Still speaking" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(recording.transcripts, ["Still speaking"]);
  await recording.emit(0.25);
  assert.equal(recording.calls.length, 2);
  assert.equal(recording.calls[1].audio.size, 44 + 5.75 * 32000);
  recording.session.stop();
  assert.equal(recording.calls[1].signal.aborted, true);
  assert.deepEqual(recording.disconnected.sort(), ["mute", "processor", "source"]);
});

test("Stopping during module loading or transcription cannot publish stale captions", async () => {
  const module = deferred();
  const loading = capture({ module });
  loading.session.stop();
  module.resolve();
  await loading.session.ready;
  assert.equal(loading.calls.length, 0);
  const response = deferred();
  const pending = capture({ response });
  await pending.session.ready;
  await pending.emit(2.5);
  pending.session.stop();
  response.resolve({ transcript: "Late result" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(pending.transcripts, []);
  assert.equal(pending.calls[0].signal.aborted, true);
});

test("Silence is free of preview calls, requests are bounded, and caption failure ends preview only", async () => {
  const recording = capture();
  await recording.session.ready;
  await recording.emit(2.5, 0);
  assert.equal(recording.calls.length, 0);
  for (let index = 0; index < 20; index++) await recording.emit(2.5);
  assert.ok(recording.calls.length <= 10);
  assert.ok(recording.calls.every(({ audio }) => audio.size <= 960044));
  recording.session.stop();
  const response = deferred();
  const failed = capture({ response });
  await failed.session.ready;
  await failed.emit(2.5);
  response.reject(new Error("Preview not available"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failed.unavailable, 1);
  await failed.emit(2.5);
  assert.equal(failed.calls.length, 1);
});

test("The audio worklet mixes channels to mono and never monitors microphone audio", async () => {
  const source = await readFile(new URL("../src/utils/liveCaptions.worklet.js", import.meta.url), "utf8");
  let Processor;
  const messages = [];
  vm.runInNewContext(source, {
    sampleRate: 16000,
    Float32Array,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: (data) => messages.push(data) }; } },
    registerProcessor: (name, processor) => { assert.equal(name, "loft-live-captions"); Processor = processor; },
  });
  const processor = new Processor();
  const output = new Float32Array(4000);
  assert.equal(processor.process([[new Float32Array(4000).fill(0.25), new Float32Array(4000).fill(0.75)]], [[output]]), true);
  assert.equal(messages.length, 1);
  assert.equal(messages[0][0], 0.5);
  assert.ok(output.every((sample) => sample === 0));
});

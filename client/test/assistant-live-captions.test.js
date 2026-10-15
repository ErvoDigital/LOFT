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
    context, stream: {},
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

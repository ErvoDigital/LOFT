import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/components/assistant/VoiceAssistant.jsx", import.meta.url))],
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", external: ["react", "react/jsx-runtime"],
  plugins: [{ name: "voice-dependencies", setup(builder) {
    builder.onResolve({ filter: /^(react-dom|lucide-react)$/ }, ({ path }) => ({ path, namespace: "mock" }));
    builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: `module.exports = globalThis.mocks[${JSON.stringify(path)}];`, loader: "js" }));
  } }],
});

async function mount(t, overrides = {}) {
  const listeners = new Map();
  const timers = new Map();
  const frames = new Map();
  let nextFrame = 0;
  const events = [];
  const body = {};
  const props = {
    active: true, phase: "done", heard: "My question", reply: "My answer", audioStatus: "ready", canPlay: true,
    onPrepareAudio: () => events.push("prepare"),
    onPlay: () => events.push("play"),
    onHoldStart: () => events.push("start"),
    onHoldEnd: () => events.push("end"),
    onClose() {},
    ...overrides,
  };
  const exported = { exports: {} };
  vm.runInNewContext(bundled.outputFiles[0].text, {
    module: exported, require: createRequire(import.meta.url),
    mocks: {
      "react-dom": { createPortal: (children) => children },
      "lucide-react": Object.fromEntries(["Minus", "Sparkles", "Volume2", "VolumeX", "X"].map((name) => [name, () => null])),
    },
    window: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name), matchMedia: () => ({ matches: true }) },
    document: { body, addEventListener() {}, removeEventListener() {} },
    performance: { now: () => 0 },
    requestAnimationFrame: (fn) => { const id = ++nextFrame; frames.set(id, fn); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: (fn) => { timers.set(1, fn); return 1; }, clearTimeout: (id) => timers.delete(id),
  });
  let view;
  await act(async () => { view = create(React.createElement(exported.exports.default, props), {
    createNodeMock: ({ props: nodeProps }) => nodeProps["aria-label"] === "Lofty's voice transcript" ? overrides.transcriptViewport || null : null,
  }); });
  t.after(() => act(() => view.unmount()));
  const click = async (label) => act(async () => view.root.findAllByType("button").find((b) => b.props["aria-label"] === label || b.props.title === label).props.onClick());
  const update = async (changes) => { Object.assign(props, changes); await act(async () => view.update(React.createElement(exported.exports.default, props))); };
  const tick = async () => { await act(async () => { const pending = [...frames]; frames.clear(); for (const [, fn] of pending) fn(16); }); };
  const spokenText = () => view.root.findAllByProps({ "aria-label": "Lofty's spoken reply" })[0]?.children.join("") || "";
  return { view, events, listeners, timers, frames, body, click, update, tick, spokenText };
}

test("The talk key prepares playback during the gesture before the hold timer starts recording", async (t) => {
  const bubble = await mount(t, { active: false });
  bubble.listeners.get("keydown")({ key: "m", target: bubble.body });
  assert.deepEqual(bubble.events, ["prepare"]);
  await act(async () => bubble.timers.get(1)());
  assert.deepEqual(bubble.events, ["prepare", "start"]);
  await act(async () => bubble.listeners.get("keyup")({ key: "m" }));
  assert.deepEqual(bubble.events, ["prepare", "start", "end"]);
});

test("Typing M in the text chat does not activate voice or prepare audio", async (t) => {
  const bubble = await mount(t);
  bubble.listeners.get("keydown")({ key: "m", target: { tagName: "INPUT", type: "text" } });
  assert.deepEqual(bubble.events, []);
  assert.equal(bubble.timers.size, 0);
});

test("Play is available in both the full bubble and its minimized pill", async (t) => {
  const bubble = await mount(t);
  await bubble.click("Play voice reply");
  await bubble.click("Minimize");
  await bubble.click("Play voice reply");
  assert.deepEqual(bubble.events, ["play", "play"]);
});

test("Synthesis failures offer Retry audio directly inside the bubble", async (t) => {
  const bubble = await mount(t, { phase: "error", audioStatus: "failed", error: "Speech unavailable" });
  assert.ok(bubble.view.root.findByProps({ role: "alert" }).children.includes("Speech unavailable"));
  await bubble.click("Retry voice reply");
  assert.deepEqual(bubble.events, ["play"]);
});

test("The full and minimized bubble show the audio generation status", async (t) => {
  const bubble = await mount(t, { phase: "thinking", audioStatus: "generating", canPlay: false });
  assert.ok(bubble.view.root.findByProps({ role: "status" }).children.includes("Generating audio…"));
  await bubble.click("Minimize");
  assert.ok(JSON.stringify(bubble.view.toJSON()).includes("Generating audio…"));
});

test("Reply text waits for speech and reveals beneath the orb using the media clock", async (t) => {
  const audio = { currentTime: 0, duration: 10, ended: false };
  const bubble = await mount(t, { phase: "thinking", audioStatus: "generating", reply: "One two three four", replyId: 1, audio });
  assert.equal(bubble.spokenText(), "");
  await bubble.update({ phase: "done", audioStatus: "ready" });
  assert.equal(bubble.spokenText(), "");
  await bubble.update({ phase: "speaking", canPlay: false, canSkip: true });
  assert.equal(bubble.spokenText(), "One");
  audio.currentTime = 3;
  await bubble.tick();
  assert.equal(bubble.spokenText(), "One two");
  // A frozen media clock (buffering or suspension) must freeze the text too.
  await bubble.tick();
  assert.equal(bubble.spokenText(), "One two");
  audio.currentTime = 10;
  audio.ended = true;
  await bubble.update({ phase: "done", canPlay: true, canSkip: false });
  assert.equal(bubble.spokenText(), "One two three four");
});

test("Minimizing continues transcript progress and replay begins the reveal again", async (t) => {
  const audio = { currentTime: 0, duration: 10, ended: false };
  const bubble = await mount(t, { phase: "speaking", reply: "One two three four", replyId: 1, audio });
  await bubble.click("Minimize");
  audio.currentTime = 6;
  await bubble.tick();
  await bubble.click("Show Lofty voice");
  assert.equal(bubble.spokenText(), "One two three");
  audio.currentTime = 10;
  audio.ended = true;
  await bubble.update({ phase: "done" });
  assert.equal(bubble.spokenText(), "One two three four");
  audio.currentTime = 0;
  audio.ended = false;
  await bubble.update({ phase: "speaking" });
  assert.equal(bubble.spokenText(), "One");
});

test("Skipping reveals the completed transcript and a new turn clears the previous reply", async (t) => {
  const audio = { currentTime: 3, duration: 10, ended: false };
  const bubble = await mount(t, { phase: "speaking", reply: "One two three four", replyId: 1, audio });
  assert.equal(bubble.spokenText(), "One two");
  await bubble.update({ phase: "done" });
  assert.equal(bubble.spokenText(), "One two three four");
  await bubble.update({ phase: "thinking", reply: "Different reply", replyId: 2, audio: null, audioStatus: "generating" });
  assert.equal(bubble.spokenText(), "");
});

test("Autoplay-blocked replies wait for playback while retaining Play controls", async (t) => {
  const audio = { currentTime: 0, duration: 10, ended: false };
  const bubble = await mount(t, { phase: "error", audioStatus: "ready", error: "Audio is ready. Tap Play to listen.", audio });
  assert.equal(bubble.spokenText(), "");
  await bubble.click("Play voice reply");
  assert.deepEqual(bubble.events, ["play"]);
});

function scrollViewport() {
  let top = 0;
  return {
    clientHeight: 100,
    scrollHeight: 220,
    get scrollTop() { return top; },
    set scrollTop(value) { top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)); },
  };
}

test("The spoken transcript follows new words, yields to manual scrolling and resumes at the bottom", async (t) => {
  const viewport = scrollViewport();
  const audio = { currentTime: 3, duration: 10, ended: false };
  const bubble = await mount(t, { phase: "speaking", reply: "One two three four", replyId: 1, audio, transcriptViewport: viewport });
  const transcript = () => bubble.view.root.findByProps({ "aria-label": "Lofty's voice transcript" });
  const scroll = async (top) => {
    viewport.scrollTop = top;
    await act(async () => transcript().props.onScroll({ currentTarget: viewport }));
  };
  assert.equal(viewport.scrollTop, 120);
  assert.equal(transcript().props["data-scrolled"], true);
  await scroll(0);
  assert.equal(transcript().props["data-scrolled"], false);
  viewport.scrollHeight = 280;
  audio.currentTime = 6;
  await bubble.tick();
  assert.equal(bubble.spokenText(), "One two three");
  assert.equal(viewport.scrollTop, 0);
  await scroll(180);
  viewport.scrollHeight = 340;
  audio.currentTime = 9;
  await bubble.tick();
  assert.equal(viewport.scrollTop, 240);
  assert.equal(bubble.spokenText(), "One two three four");
});

test("Replay and new replies restore automatic transcript scrolling after reading older lines", async (t) => {
  const viewport = scrollViewport();
  const audio = { currentTime: 10, duration: 10, ended: true };
  const bubble = await mount(t, { phase: "done", reply: "One two three four", replyId: 1, audio, transcriptViewport: viewport });
  const scrollBack = async () => {
    viewport.scrollTop = 0;
    await act(async () => bubble.view.root.findByProps({ "aria-label": "Lofty's voice transcript" }).props.onScroll({ currentTarget: viewport }));
  };
  await scrollBack();
  audio.currentTime = 0;
  audio.ended = false;
  viewport.scrollHeight = 40;
  await bubble.update({ phase: "speaking" });
  assert.equal(bubble.spokenText(), "One");
  viewport.scrollHeight = 220;
  audio.currentTime = 6;
  await bubble.tick();
  assert.equal(viewport.scrollTop, 120);
  await scrollBack();
  await bubble.update({ replyId: 2, reply: "A different longer answer" });
  assert.equal(viewport.scrollTop, 120);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";
import { build } from "esbuild";

// Exercise the widget's real event handlers and effects, with browser devices
// and API calls replaced so tests never use a microphone or a paid provider.
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/components/assistant/AssistantWidget.jsx", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  external: ["react", "react/jsx-runtime"],
  plugins: [{
    name: "widget-dependencies",
    setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
        if (kind === "entry-point" || path === "react" || path === "react/jsx-runtime") return;
        return { path, namespace: "mock" };
      });
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({
        contents: `module.exports = globalThis.mocks[${JSON.stringify(path)}];`,
        loader: "js",
      }));
    },
  }],
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function mount(t, overrides = {}) {
  const messages = [];
  const speech = [];
  const audio = [];
  const revoked = [];
  let recorder;
  let stoppedTracks = 0;
  const api = {
    assistantStatus: async () => ({ configured: true }),
    sendAssistantMessage: async (body) => { messages.push(body); return overrides.reply ? overrides.reply.promise : { reply: "Your summary.", actions: [] }; },
    transcribeAssistantAudio: async () => overrides.transcript ? overrides.transcript.promise : { transcript: "What is due today?" },
    speakAssistantReply: async (text, context, signal) => {
      speech.push({ text, context, signal });
      if (overrides.speechError) throw overrides.speechError;
      return overrides.speech ? overrides.speech.promise : new Blob(["audio"], { type: "audio/mpeg" });
    },
  };
  const mockComponent = () => null;
  const exported = { exports: {} };
  vm.runInNewContext(bundled.outputFiles[0].text, {
    module: exported,
    require: createRequire(import.meta.url),
    mocks: {
      "react-router-dom": { Link: () => null, useLocation: () => ({ pathname: "/" }), useParams: () => ({}) },
      "lucide-react": Object.fromEntries(["Layers", "Mic", "Sparkles", "Square", "Volume2", "VolumeX", "X"].map((name) => [name, () => null])),
      "../../context/AuthContext.jsx": { useAuth: () => ({ user: { id: "tester", name: "Tester" } }) },
      "../../context/WorkspaceContext.jsx": { useWorkspaces: () => ({ workspaces: [] }) },
      "../common/WorkspaceMark.jsx": mockComponent,
      "./VoiceRecordingIndicator.jsx": mockComponent,
      "../../api/assistant.js": api,
      "../../api/client.js": { apiErrorMessage: (err) => err.message },
    },
    document: { addEventListener() {}, removeEventListener() {} },
    navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stoppedTracks++ }] }) } },
    MediaRecorder: class {
      static isTypeSupported() { return true; }
      constructor() { recorder = this; this.state = "inactive"; this.mimeType = "audio/webm"; }
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable({ data: new Blob(["voice"]) });
        void this.onstop();
      }
    },
    Audio: class {
      constructor(url) { this.url = url; this.paused = false; this.played = false; this.playCount = 0; audio.push(this); }
      async play() {
        this.playCount++;
        if (overrides.blockAutoplay && this.playCount === 1) throw Object.assign(new Error("Autoplay blocked"), { name: "NotAllowedError" });
        this.played = true;
      }
      pause() { this.paused = true; }
    },
    URL: { createObjectURL: () => "blob:test-audio", revokeObjectURL: (url) => revoked.push(url) },
    Blob,
    AbortController,
    setTimeout,
    clearTimeout,
  });
  let view;
  await act(async () => { view = create(React.createElement(exported.exports.default)); });
  t.after(() => act(() => view.unmount()));
  const button = (label) => view.root.findAllByType("button").find(({ props }) => props["aria-label"] === label || props.title === label);
  const click = async (label) => { await act(async () => button(label).props.onClick()); };
  const type = async (value) => { await act(async () => view.root.findByType("input").props.onChange({ target: { value } })); };
  const submit = async () => { await act(async () => view.root.findByType("form").props.onSubmit({ preventDefault() {} })); };
  const record = async () => { await click("Enable voice mode"); await click("Record voice"); await click("Stop recording"); };
  await click("Open Lofty");
  return { view, messages, speech, audio, revoked, click, type, submit, record, get recorder() { return recorder; }, get stoppedTracks() { return stoppedTracks; } };
}

test("Typed messages get text replies even if voice is enabled while the reply is pending", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply });
  await widget.type("Help me plan");
  await widget.submit();
  assert.equal(widget.messages[0].interactionMode, "text");
  await widget.click("Enable voice mode");
  await act(async () => reply.resolve({ reply: "Here is your plan.", actions: [] }));
  assert.equal(widget.speech.length, 0);
  assert.equal(widget.audio.length, 0);
  assert.ok(widget.view.root.findAllByType("p").some((p) => p.children.includes("Here is your plan.")));
});

test("Voice recordings are submitted automatically and their replies play as audio", async (t) => {
  const widget = await mount(t);
  await widget.record();
  assert.equal(widget.messages[0].message, "What is due today?");
  assert.equal(widget.messages[0].interactionMode, "voice");
  assert.equal(widget.speech[0].text, "Your summary.");
  assert.equal(widget.audio[0].played, true);
  assert.ok(widget.stoppedTracks > 0);
  assert.equal(JSON.stringify(widget.view.toJSON()).includes("Your summary."), false);
  await widget.click("Stop voice reply");
  await widget.click("Play voice reply");
  assert.equal(widget.audio[0].playCount, 2);
  assert.equal(widget.speech.length, 1);
  await widget.type("Now give me the details");
  await widget.submit();
  assert.equal(widget.messages[1].interactionMode, "text");
  assert.equal(widget.speech.length, 1);
  assert.equal(widget.audio[0].paused, true);
  // Audio remains cached for replay until the conversation is cleared.
  assert.equal(widget.revoked.length, 0);
  assert.equal(widget.view.root.findAllByType("button").some((b) => b.props.title === "Enable voice mode"), true);
});

test("Disabling and re-enabling voice cannot speak an earlier pending reply", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply });
  await widget.record();
  await widget.click("Exit voice mode");
  await widget.click("Enable voice mode");
  await act(async () => reply.resolve({ reply: "A delayed summary.", actions: [] }));
  assert.equal(widget.speech.length, 0);
});

test("Leaving voice mode aborts pending speech generation and prevents delayed playback", async (t) => {
  const speech = deferred();
  const widget = await mount(t, { speech });
  await widget.record();
  assert.equal(widget.speech.length, 1);
  await widget.click("Exit voice mode");
  assert.equal(widget.speech[0].signal.aborted, true);
  await act(async () => speech.resolve(new Blob(["audio"])));
  assert.equal(widget.audio.length, 0);
});

test("Leaving voice mode cancels transcription and releases the text composer", async (t) => {
  const transcript = deferred();
  const widget = await mount(t, { transcript });
  await widget.record();
  await widget.click("Exit voice mode");
  await widget.type("Use text instead");
  await widget.submit();
  await act(async () => transcript.resolve({ transcript: "Canceled voice message" }));
  assert.equal(widget.messages.length, 1);
  assert.equal(widget.messages[0].message, "Use text instead");
  assert.equal(widget.messages[0].interactionMode, "text");
  assert.equal(widget.speech.length, 0);
});

test("Starting a new recording stops reply audio before opening the microphone", async (t) => {
  const widget = await mount(t);
  await widget.record();
  await widget.click("Record voice");
  assert.equal(widget.audio[0].paused, true);
  assert.equal(widget.speech.length, 1);
  await widget.click("Exit voice mode");
  assert.equal(widget.recorder.state, "inactive");
  assert.equal(widget.messages.length, 1);
});

test("Closing Lofty prevents pending voice audio from playing", async (t) => {
  const speech = deferred();
  const widget = await mount(t, { speech });
  await widget.record();
  await widget.click("Close Lofty");
  assert.equal(widget.speech[0].signal.aborted, true);
  await act(async () => speech.resolve(new Blob(["audio"])));
  assert.equal(widget.audio.length, 0);
});

test("Pending voice generation shows audio status without revealing the text reply", async (t) => {
  const speech = deferred();
  const widget = await mount(t, { speech });
  await widget.record();
  assert.equal(JSON.stringify(widget.view.toJSON()).includes("Your summary."), false);
  assert.ok(widget.view.root.findAllByProps({ role: "status" }).some((p) => p.children.includes("Generating audio…")));
  await act(async () => speech.resolve(new Blob(["audio"])));
  assert.equal(widget.audio[0].played, true);
});

test("Voice generation errors keep the response in voice mode and offer a retry", async (t) => {
  const overrides = { speechError: new Error("Voice generation is unavailable.") };
  const widget = await mount(t, overrides);
  await widget.record();
  assert.equal(JSON.stringify(widget.view.toJSON()).includes("Your summary."), false);
  assert.ok(widget.view.root.findByProps({ role: "alert" }).children.includes("Voice generation is unavailable."));
  assert.equal(widget.audio.length, 0);
  overrides.speechError = null;
  await widget.click("Retry voice reply");
  assert.equal(widget.messages.length, 1);
  assert.equal(widget.speech.length, 2);
  assert.equal(widget.audio[0].played, true);
});

test("Autoplay restrictions preserve generated audio for one-click playback", async (t) => {
  const widget = await mount(t, { blockAutoplay: true });
  await widget.record();
  assert.ok(widget.view.root.findByProps({ role: "alert" }).children.includes("Audio is ready. Tap Play to listen."));
  await widget.click("Play voice reply");
  assert.equal(widget.audio[0].played, true);
  assert.equal(widget.speech.length, 1);
  assert.equal(JSON.stringify(widget.view.toJSON()).includes("Your summary."), false);
});

test("Generated audio URLs are released when the widget is unmounted", async (t) => {
  const widget = await mount(t);
  await widget.record();
  await act(async () => widget.view.unmount());
  assert.ok(widget.revoked.includes("blob:test-audio"));
  assert.equal(widget.audio[0].paused, true);
});

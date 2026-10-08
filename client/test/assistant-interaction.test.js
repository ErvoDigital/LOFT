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
        if (kind === "entry-point" || path === "react" || path === "react/jsx-runtime" || path.endsWith("/assistantAudio.js") || path.endsWith("/VoiceOrb.jsx")) return;
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
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function mount(t, overrides = {}) {
  const messages = [];
  const speech = [];
  const audio = [];
  const revoked = [];
  const confirmations = [];
  const listeners = new Map();
  const recordingTimers = new Map();
  const document = { visibilityState: "visible", addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) };
  let progress;
  let recorder;
  let stoppedTracks = 0;
  let microphoneRequests = 0;
  const api = {
    assistantStatus: async () => ({ configured: overrides.configured ?? true }),
    confirmAssistantAction: async (token) => { confirmations.push(token); return { id: "saved", workspaceId: "workspace" }; },
    sendAssistantMessage: async (body, signal, onProgress) => { messages.push(body); progress = onProgress; return overrides.reply ? overrides.reply.promise : { reply: "Your summary.", actions: [] }; },
    transcribeAssistantAudio: async () => overrides.transcript ? overrides.transcript.promise : { transcript: "What is due today?" },
    speakAssistantReply: async (text, context, signal) => {
      speech.push({ text, context, signal });
      if (overrides.speechError) throw overrides.speechError;
      return overrides.speech ? overrides.speech.promise : new Blob(["audio"], { type: "audio/mpeg" });
    },
  };
  const mockComponent = () => null;
  const VoiceAssistant = () => null;
  const exported = { exports: {} };
  vm.runInNewContext(bundled.outputFiles[0].text, {
    module: exported,
    require: createRequire(import.meta.url),
    mocks: {
      "react-router-dom": { Link: ({ to, children }) => React.createElement("a", { href: to }, children), useLocation: () => ({ pathname: "/" }), useParams: () => ({}) },
      "lucide-react": Object.fromEntries(["Layers", "Mic", "Sparkles", "Square", "Volume2", "VolumeX", "X"].map((name) => [name, () => null])),
      "../../context/AuthContext.jsx": { useAuth: () => ({ user: { id: "tester", name: "Tester" } }) },
      "../../context/WorkspaceContext.jsx": { useWorkspaces: () => ({ workspaces: [] }) },
      "../common/WorkspaceMark.jsx": mockComponent,
      "./VoiceRecordingIndicator.jsx": mockComponent,
      "./VoiceAssistant.jsx": VoiceAssistant,
      "../../api/assistant.js": api,
      "../../api/client.js": { apiErrorMessage: (err) => err.message },
    },
    document,
    window: overrides.audioContext ? { AudioContext: class { constructor() { return overrides.audioContext; } } } : {},
    navigator: overrides.unsupported ? {} : { mediaDevices: { getUserMedia: async () => {
      microphoneRequests++;
      if (overrides.microphoneError) throw overrides.microphoneError;
      if (overrides.microphone) await overrides.microphone.promise;
      return { getTracks: () => [{ stop: () => stoppedTracks++ }] };
    } } },
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
    setTimeout: (fn, delay) => {
      if (overrides.captureRecordingTimer && delay === 30000) { recordingTimers.set("recording", fn); return "recording"; }
      return setTimeout(fn, delay);
    },
    clearTimeout: (id) => { if (id === "recording") recordingTimers.delete(id); else clearTimeout(id); },
  });
  let view;
  await act(async () => { view = create(React.createElement(exported.exports.default)); });
  t.after(() => act(() => view.unmount()));
  const button = (label) => view.root.findAllByType("button").find(({ props }) => props["aria-label"] === label || props.title === label);
  const bubble = () => view.root.findByType(VoiceAssistant).props;
  const click = async (label) => {
    const voiceActions = { "Close voice bubble": "onClose", "Play voice reply": "onPlay", "Retry voice reply": "onPlay", "Stop voice reply": "onSkip" };
    await act(async () => voiceActions[label] ? bubble()[voiceActions[label]]() : button(label).props.onClick());
  };
  const type = async (value) => { await act(async () => view.root.findByType("input").props.onChange({ target: { value } })); };
  const submit = async () => { await act(async () => view.root.findByType("form").props.onSubmit({ preventDefault() {} })); };
  const startRecording = async () => { await act(async () => { bubble().onPrepareAudio(); return bubble().onHoldStart(); }); };
  const record = async () => { await startRecording(); await act(async () => bubble().onHoldEnd()); };
  const hide = async () => { document.visibilityState = "hidden"; await act(async () => listeners.get("visibilitychange")?.()); };
  if (!overrides.closed) await click("Open Lofty");
  return { view, messages, speech, audio, revoked, confirmations, recordingTimers, click, type, submit, record, startRecording, hide, get progress() { return progress; }, get bubble() { return bubble(); }, get recorder() { return recorder; }, get stoppedTracks() { return stoppedTracks; }, get microphoneRequests() { return microphoneRequests; } };
}

test("The touch launcher records with chat closed and Stop sends a voice question", async (t) => {
  const widget = await mount(t, { closed: true });
  await widget.click("Talk to Lofty");
  assert.equal(widget.bubble.inputMode, "tap");
  assert.equal(widget.bubble.phase, "listening");
  assert.equal(widget.recorder.state, "recording");
  assert.equal(widget.messages.length, 0);
  assert.equal(widget.view.root.findAllByType("input").length, 0);
  await act(async () => widget.bubble.onHoldEnd());
  assert.equal(widget.messages[0].interactionMode, "voice");
  assert.equal(widget.audio[0].played, true);
  assert.ok(widget.stoppedTracks > 0);
});

test("The Talk button in chat starts the same independent tap voice session", async (t) => {
  const widget = await mount(t);
  await widget.click("Talk to Lofty");
  assert.equal(widget.bubble.inputMode, "tap");
  assert.equal(widget.bubble.micReady, true);
  await widget.click("Close Lofty");
  assert.equal(widget.recorder.state, "recording");
  await act(async () => widget.bubble.onHoldEnd());
  assert.equal(widget.messages[0].interactionMode, "voice");
});

test("Permission delays do not allow duplicate captures and closing cancels the pending microphone", async (t) => {
  const microphone = deferred();
  const widget = await mount(t, { closed: true, microphone });
  await widget.click("Talk to Lofty");
  assert.equal(widget.bubble.micReady, false);
  assert.equal(widget.bubble.onTalkStart(), false);
  assert.equal(widget.microphoneRequests, 1);
  await widget.click("Close voice bubble");
  await act(async () => microphone.resolve());
  assert.equal(widget.recorder, undefined);
  assert.equal(widget.stoppedTracks, 1);
  assert.equal(widget.messages.length, 0);
});

test("Tap recording stops and submits at the 30-second limit", async (t) => {
  const widget = await mount(t, { closed: true, captureRecordingTimer: true });
  await widget.click("Talk to Lofty");
  await act(async () => widget.recordingTimers.get("recording")());
  assert.equal(widget.recorder.state, "inactive");
  assert.equal(widget.bubble.phase, "speaking");
  assert.equal(widget.bubble.canTalk, true);
  assert.equal(widget.messages.length, 1);
  assert.ok(widget.stoppedTracks > 0);
});

test("Hiding the page ends a tap recording and releases its microphone", async (t) => {
  const widget = await mount(t, { closed: true });
  await widget.click("Talk to Lofty");
  await widget.hide();
  assert.equal(widget.recorder.state, "inactive");
  assert.ok(widget.stoppedTracks > 0);
  assert.equal(widget.messages.length, 1);
});

test("Hiding the page during permission does not start recording when permission arrives", async (t) => {
  const microphone = deferred();
  const widget = await mount(t, { closed: true, microphone });
  await widget.click("Talk to Lofty");
  await widget.hide();
  await act(async () => microphone.resolve());
  assert.equal(widget.recorder, undefined);
  assert.equal(widget.stoppedTracks, 1);
  assert.equal(widget.messages.length, 0);
  assert.equal(widget.bubble.phase, "error");
});

test("Tap microphone failures clear Listening and allow another attempt", async (t) => {
  const widget = await mount(t, { closed: true, microphoneError: new Error("Permission denied") });
  await widget.click("Talk to Lofty");
  assert.equal(widget.bubble.phase, "error");
  assert.match(widget.bubble.error, /permissions/);
  assert.equal(widget.bubble.canTalk, true);
  await act(async () => widget.bubble.onTalkStart());
  assert.equal(widget.microphoneRequests, 2);
});

test("Closing a tap recording cancels the clip and releases the microphone", async (t) => {
  const widget = await mount(t, { closed: true });
  await widget.click("Talk to Lofty");
  await widget.click("Close voice bubble");
  assert.equal(widget.recorder.state, "inactive");
  assert.ok(widget.stoppedTracks > 0);
  assert.equal(widget.messages.length, 0);
  assert.equal(widget.bubble.active, false);
});

test("Releasing M during permission avoids capturing or submitting an empty clip", async (t) => {
  const microphone = deferred();
  const widget = await mount(t, { closed: true, microphone });
  await widget.startRecording();
  await act(async () => widget.bubble.onHoldEnd());
  await act(async () => microphone.resolve());
  assert.equal(widget.recorder, undefined);
  assert.equal(widget.stoppedTracks, 1);
  assert.equal(widget.messages.length, 0);
  assert.equal(widget.bubble.phase, "error");
});

test("Unsupported browsers and unfinished setup show errors instead of waiting for a key release", async (t) => {
  for (const overrides of [{ unsupported: true }, { configured: false }]) {
    const widget = await mount(t, { closed: true, ...overrides });
    await widget.click("Talk to Lofty");
    assert.equal(widget.bubble.phase, "error");
    assert.equal(widget.bubble.canTalk, true);
    assert.equal(widget.microphoneRequests, 0);
  }
});

test("Chat renders streamed text early and replaces tool preambles with one final reply", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply });
  await widget.type("Help me plan");
  await widget.submit();
  await act(async () => widget.progress({ type: "delta", text: "Checking your tasks." }));
  assert.ok(JSON.stringify(widget.view.toJSON()).includes("Checking your tasks."));
  assert.equal(widget.bubble.onHoldStart(), false);
  assert.equal(widget.confirmations.length, 0);
  await act(async () => widget.progress({ type: "reset" }));
  assert.ok(!JSON.stringify(widget.view.toJSON()).includes("Checking your tasks."));
  await act(async () => widget.progress({ type: "delta", text: "Your plan" }));
  await act(async () => reply.resolve({ reply: "Your plan is ready.", actions: [] }));
  const replies = widget.view.root.findAllByType("p").filter((p) => p.children.includes("Your plan is ready."));
  assert.equal(replies.length, 1);
  assert.equal(widget.speech.length, 0);
  assert.equal(widget.bubble.onHoldStart(), true);
});

test("A failed stream removes provisional text and restores the question for retry", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply });
  await widget.type("Plan my day");
  await widget.submit();
  await act(async () => widget.progress({ type: "delta", text: "An unfinished answer" }));
  await act(async () => reply.reject(new Error("Stream interrupted")));
  assert.ok(!JSON.stringify(widget.view.toJSON()).includes("An unfinished answer"));
  assert.equal(widget.view.root.findByType("input").props.value, "Plan my day");
  assert.ok(JSON.stringify(widget.view.toJSON()).includes("Stream interrupted"));
});

test("Meeting draft previews handle absent dates and save only after confirmation", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply });
  await widget.type("Prepare a planning meeting. I'll add the details later.");
  await widget.submit();
  await act(async () => reply.resolve({ reply: "Confirm to save the draft.", actions: [{ id: "proposal", token: "signed-draft", kind: "event_draft", data: { title: "Planning", workspaceId: "workspace", location: "Room A", deferredFields: ["startTime", "endTime", "attendeeIds"] } }] }));
  const content = JSON.stringify(widget.view.toJSON());
  assert.match(content, /Save meeting draft/);
  assert.match(content, /Unscheduled draft/);
  assert.match(content, /To add later/);
  assert.doesNotMatch(content, /Invalid Date/);
  assert.equal(widget.confirmations.length, 0);
  await act(async () => widget.view.root.findAllByType("button").find((b) => b.children.includes("Confirm")).props.onClick());
  assert.deepEqual(widget.confirmations, ["signed-draft"]);
  assert.equal(widget.view.root.findByType("a").props.href, "/workspaces/workspace/calendar");
});

test("Deferred task previews disclose the default priority and unassigned state", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply });
  await widget.type("Create a task; I'll add its details later.");
  await widget.submit();
  await act(async () => reply.resolve({ reply: "Confirm below.", actions: [{ id: "proposal", kind: "task", data: { title: "Untitled task", workspaceId: "workspace", tier: "TIER_3", assigneeId: null, deferredFields: ["title", "tier", "assigneeId"] } }] }));
  const content = JSON.stringify(widget.view.toJSON());
  assert.match(content, /Flexible/);
  assert.match(content, /default until you edit it/);
  assert.match(content, /Unassigned/);
  assert.equal(widget.confirmations.length, 0);
});

test("Typed messages get text replies and cannot start the bubble while reasoning is pending", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply });
  await widget.type("Help me plan");
  await widget.submit();
  assert.equal(widget.messages[0].interactionMode, "text");
  assert.equal(widget.bubble.onHoldStart(), false);
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
  assert.equal(widget.bubble.audio, widget.audio[0]);
  assert.ok(widget.stoppedTracks > 0);
  assert.equal(JSON.stringify(widget.view.toJSON()).includes("Your summary."), true);
  assert.equal(widget.bubble.phase, "speaking");
  await widget.click("Stop voice reply");
  await widget.click("Play voice reply");
  assert.equal(widget.audio[0].playCount, 2);
  assert.equal(widget.speech.length, 1);
  await widget.type("Now give me the details");
  await widget.submit();
  assert.equal(widget.messages[1].interactionMode, "text");
  assert.equal(widget.speech.length, 1);
  assert.equal(widget.bubble.reply, "Your summary.");
  assert.equal(widget.bubble.phase, "speaking");
  assert.deepEqual(Array.from(widget.messages[1].history, ({ role, content }) => ({ role, content })), [
    { role: "user", content: "What is due today?" },
    { role: "assistant", content: "Your summary." },
  ]);
  // Audio remains cached for replay until the conversation is cleared.
  assert.equal(widget.revoked.length, 0);
  assert.equal(widget.view.root.findAllByType("button").some((b) => b.props.title === "Enable voice mode" || b.props.title === "Record voice"), false);
});

test("Closing the bubble cannot speak an earlier pending reply, but keeps its text in chat", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply });
  await widget.record();
  await widget.click("Close voice bubble");
  await act(async () => reply.resolve({ reply: "A delayed summary.", actions: [] }));
  assert.equal(widget.speech.length, 0);
  assert.equal(widget.bubble.active, false);
  assert.ok(JSON.stringify(widget.view.toJSON()).includes("A delayed summary."));
});

test("Closing the bubble aborts pending speech generation and prevents delayed playback", async (t) => {
  const speech = deferred();
  const widget = await mount(t, { speech });
  await widget.record();
  assert.equal(widget.speech.length, 1);
  await widget.click("Close voice bubble");
  assert.equal(widget.speech[0].signal.aborted, true);
  await act(async () => speech.resolve(new Blob(["audio"])));
  assert.equal(widget.audio.length, 0);
});

test("Closing the bubble cancels transcription and releases the text composer", async (t) => {
  const transcript = deferred();
  const widget = await mount(t, { transcript });
  await widget.record();
  await widget.click("Close voice bubble");
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
  await widget.startRecording();
  assert.equal(widget.audio[0].paused, true);
  assert.equal(widget.speech.length, 1);
  await widget.click("Close voice bubble");
  assert.equal(widget.recorder.state, "inactive");
  assert.equal(widget.messages.length, 1);
});

test("Closing the text chat keeps independent bubble audio generating and playing", async (t) => {
  const speech = deferred();
  const widget = await mount(t, { speech });
  await widget.record();
  await widget.click("Close Lofty");
  assert.equal(widget.speech[0].signal.aborted, false);
  await act(async () => speech.resolve(new Blob(["audio"])));
  assert.equal(widget.audio[0].played, true);
  assert.equal(widget.bubble.phase, "speaking");
});

test("Bubble replies autoplay only after audio generation finishes with the text chat closed", async (t) => {
  const speech = deferred();
  const widget = await mount(t, { speech, closed: true });
  await widget.record();
  assert.equal(widget.audio.length, 0);
  assert.equal(widget.bubble.phase, "thinking");
  assert.equal(widget.bubble.audioStatus, "generating");
  assert.equal(widget.bubble.reply, "Your summary.");
  await act(async () => speech.resolve(new Blob(["audio"])));
  assert.equal(widget.audio[0].played, true);
  assert.equal(widget.bubble.phase, "speaking");
  await act(async () => widget.audio[0].onended());
  assert.equal(widget.bubble.phase, "done");
});

test("Voice generation errors are reported in the bubble and retry only synthesis", async (t) => {
  const overrides = { speechError: new Error("Voice generation is unavailable.") };
  const widget = await mount(t, overrides);
  await widget.record();
  assert.equal(JSON.stringify(widget.view.toJSON()).includes("Your summary."), true);
  assert.equal(widget.bubble.phase, "error");
  assert.equal(widget.bubble.error, "Voice generation is unavailable.");
  assert.equal(widget.bubble.canPlay, true);
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
  assert.equal(widget.bubble.error, "Audio is ready. Tap Play to listen.");
  assert.equal(widget.bubble.canPlay, true);
  await widget.click("Play voice reply");
  assert.equal(widget.audio[0].played, true);
  assert.equal(widget.speech.length, 1);
  assert.equal(JSON.stringify(widget.view.toJSON()).includes("Your summary."), true);
});

test("Text submissions do not cancel bubble synthesis or replace its answer", async (t) => {
  const speech = deferred();
  const widget = await mount(t, { speech });
  await widget.record();
  await widget.type("Give me the details in text");
  await widget.submit();
  assert.equal(widget.messages[1].interactionMode, "text");
  assert.equal(widget.speech.length, 1);
  assert.equal(widget.speech[0].signal.aborted, false);
  assert.equal(widget.bubble.audioStatus, "generating");
  await act(async () => speech.resolve(new Blob(["audio"])));
  assert.equal(widget.audio[0].played, true);
  assert.equal(widget.bubble.phase, "speaking");
});

test("New voice turns include the latest text conversation in shared history", async (t) => {
  const widget = await mount(t);
  await widget.type("My project is the launch plan");
  await widget.submit();
  await widget.record();
  assert.equal(widget.messages[1].interactionMode, "voice");
  assert.equal(widget.messages[1].history[0].content, "My project is the launch plan");
  assert.equal(widget.messages[1].history[1].content, "Your summary.");
});

test("A pending or failed text reply does not change the voice bubble's playback state", async (t) => {
  const overrides = {};
  const widget = await mount(t, overrides);
  await widget.record();
  const reply = deferred();
  overrides.reply = reply;
  await widget.type("Text follow-up");
  await widget.submit();
  assert.equal(widget.bubble.phase, "speaking");
  await act(async () => reply.reject(new Error("Text temporarily unavailable")));
  assert.equal(widget.bubble.phase, "speaking");
  assert.ok(JSON.stringify(widget.view.toJSON()).includes("Text temporarily unavailable"));
  assert.notEqual(widget.bubble.error, "Text temporarily unavailable");
});

test("The bubble uses its prepared audio context for delayed automatic playback", async (t) => {
  const speech = deferred();
  let resumed = 0;
  let closed = 0;
  const sources = [];
  const audioContext = {
    state: "suspended", currentTime: 0, destination: {},
    async resume() { resumed++; this.state = "running"; },
    async close() { closed++; },
    async decodeAudioData() { return { duration: 1 }; },
    createBufferSource() {
      const source = { connect() {}, disconnect() {}, start() { this.started = true; }, stop() {} };
      sources.push(source);
      return source;
    },
  };
  const widget = await mount(t, { audioContext, speech, closed: true });
  await widget.record();
  assert.equal(resumed, 1);
  assert.equal(sources.length, 0);
  await act(async () => speech.resolve(new Blob(["audio"])));
  assert.equal(sources[0].started, true);
  assert.equal(widget.audio.length, 0);
  assert.equal(widget.bubble.phase, "speaking");
  await act(async () => sources[0].onended());
  assert.equal(widget.bubble.phase, "done");
  await widget.click("Play voice reply");
  assert.equal(resumed, 2);
  assert.equal(sources[1].started, true);
  assert.equal(widget.speech.length, 1);
  await act(async () => widget.view.unmount());
  assert.equal(closed, 1);
});

test("Closing the bubble during audio decoding prevents delayed Web Audio playback", async (t) => {
  const decoded = deferred();
  let started = false;
  const audioContext = {
    state: "running", destination: {}, async resume() {}, async close() {},
    decodeAudioData: () => decoded.promise,
    createBufferSource() { return { connect() {}, start() { started = true; } }; },
  };
  const widget = await mount(t, { audioContext });
  await widget.record();
  assert.equal(widget.bubble.audioStatus, "generating");
  await widget.click("Close voice bubble");
  await act(async () => decoded.resolve({ duration: 1 }));
  assert.equal(started, false);
  assert.equal(widget.speech[0].signal.aborted, true);
});

test("Skipping pending synthesis prevents its audio from playing later", async (t) => {
  const speech = deferred();
  const widget = await mount(t, { speech });
  await widget.record();
  await widget.click("Stop voice reply");
  assert.equal(widget.speech[0].signal.aborted, true);
  await act(async () => speech.resolve(new Blob(["audio"])));
  assert.equal(widget.audio.length, 0);
  assert.equal(widget.bubble.audioStatus, "canceled");
});

test("Generated audio URLs are released when the widget is unmounted", async (t) => {
  const widget = await mount(t);
  await widget.record();
  await act(async () => widget.view.unmount());
  assert.ok(widget.revoked.includes("blob:test-audio"));
  assert.equal(widget.audio[0].paused, true);
});

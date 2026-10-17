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
      builder.onResolve({ filter: /.*/ }, ({ path, kind, resolveDir }) => {
        if (kind === "entry-point" || path === "react" || path === "react/jsx-runtime" || path.endsWith("/priorities.js") || path.endsWith("/assistantAudio.js") || path.endsWith("/VoiceOrb.jsx")
          || path.endsWith("/AssistantMessageContent.jsx") || path.endsWith("/AssistantActionCards.jsx") || path.endsWith("/AssistantDetailForm.jsx") || path.endsWith("/useVisualViewport.js") || path === "react-markdown" || path === "remark-gfm" || resolveDir.includes("node_modules")) return;
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
  const liveCaptions = [];
  const listeners = new Map();
  const recordingTimers = new Map();
  const document = { activeElement: overrides.focusedField, visibilityState: "visible", addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) };
  let progress;
  let recorder;
  let stoppedTracks = 0;
  let microphoneRequests = 0;
  const api = {
    assistantStatus: async () => ({ configured: overrides.configured ?? true }),
    confirmAssistantAction: async (token) => { confirmations.push(token); if (overrides.confirmationError) throw overrides.confirmationError; return overrides.confirmation ? overrides.confirmation.promise : { id: "saved", workspaceId: "workspace" }; },
    sendAssistantMessage: async (body, signal, onProgress) => { messages.push(body); progress = onProgress; return overrides.reply ? overrides.reply.promise : { reply: "Your summary.", actions: [] }; },
    transcribeAssistantAudio: async () => overrides.transcript ? overrides.transcript.promise : { transcript: "What is due today?" },
    transcribeLiveAudio: async () => ({ transcript: "What is due" }),
    speakAssistantReply: async (text, context, signal) => {
      speech.push({ text, context, signal });
      if (overrides.speechError) throw overrides.speechError;
      return overrides.speech ? overrides.speech.promise : new Blob(["audio"], { type: "audio/mpeg" });
    },
  };
  const mockComponent = () => null;
  const VoiceAssistant = ({ active, replyControls }) => active ? replyControls || null : null;
  const exported = { exports: {} };
  vm.runInNewContext(bundled.outputFiles[0].text, {
    module: exported,
    require: createRequire(import.meta.url),
    mocks: {
      "react-router-dom": { Link: ({ to, children }) => React.createElement("a", { href: to }, children), useLocation: () => ({ pathname: "/" }), useParams: () => ({}) },
      "lucide-react": Object.fromEntries(["AlertTriangle", "Layers", "Mic", "Sparkles", "Square", "Volume2", "VolumeX", "X"].map((name) => [name, () => null])),
      "../../context/AuthContext.jsx": { useAuth: () => ({ user: { id: "tester", name: "Tester" } }) },
      "../../context/WorkspaceContext.jsx": { useWorkspaces: () => ({ workspaces: [] }) },
      "../common/WorkspaceMark.jsx": mockComponent,
      "./VoiceRecordingIndicator.jsx": mockComponent,
      "./VoiceAssistant.jsx": VoiceAssistant,
      "../../utils/liveCaptions.js": { createLiveCaptions: (options) => {
        const session = { ...options, stopped: false, stop() { this.stopped = true; } };
        liveCaptions.push(session);
        return session;
      } },
      "../../api/assistant.js": api,
      "../../api/client.js": { apiErrorMessage: (err) => err.message },
    },
    document,
    window: {
      requestAnimationFrame: overrides.requestAnimationFrame,
      cancelAnimationFrame: overrides.cancelAnimationFrame,
      ...(overrides.audioContext ? { AudioContext: class { constructor() { return overrides.audioContext; } } } : {}),
      visualViewport: overrides.viewport,
      matchMedia: () => ({ matches: Boolean(overrides.touch) }),
    },
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
  await act(async () => { view = create(React.createElement(exported.exports.default), {
    createNodeMock: ({ props }) => props.id === "loft-assistant" ? overrides.panel || null
      : props["aria-label"] === "Message Lofty" ? overrides.input || null : null,
  }); });
  t.after(() => act(() => view.unmount()));
  const button = (label) => view.root.findAllByType("button").find(({ props }) => props["aria-label"] === label || props.title === label);
  const bubble = () => view.root.findByType(VoiceAssistant).props;
  const click = async (label) => {
    const voiceActions = { "Close voice bubble": "onClose", "Play voice reply": "onPlay", "Retry voice reply": "onPlay", "Stop voice reply": "onSkip" };
    await act(async () => voiceActions[label] ? bubble()[voiceActions[label]]() : button(label).props.onClick());
  };
  const type = async (value) => { await act(async () => view.root.findByProps({ "aria-label": "Message Lofty" }).props.onChange({ target: { value } })); };
  const submit = async () => { await act(async () => view.root.findAllByType("form").find((form) => !form.props["aria-label"]).props.onSubmit({ preventDefault() {} })); };
  const startRecording = async () => { await act(async () => { bubble().onPrepareAudio(); return bubble().onHoldStart(); }); };
  const record = async () => { await startRecording(); await act(async () => bubble().onHoldEnd()); };
  const hide = async () => { document.visibilityState = "hidden"; await act(async () => listeners.get("visibilitychange")?.()); };
  if (!overrides.closed) await click("Open Lofty");
  return { view, messages, speech, audio, revoked, confirmations, liveCaptions, recordingTimers, click, type, submit, record, startRecording, hide, get progress() { return progress; }, get bubble() { return bubble(); }, get recorder() { return recorder; }, get stoppedTracks() { return stoppedTracks; }, get microphoneRequests() { return microphoneRequests; } };
}

test("Live captions update while recording and only the final transcript submits a question", async (t) => {
  const transcript = deferred();
  const widget = await mount(t, { transcript, closed: true });
  await widget.click("Talk to Lofty");
  await act(async () => widget.liveCaptions[0].onTranscript("What is due"));
  assert.equal(widget.bubble.heard, "What is due");
  assert.equal(widget.bubble.interimTranscript, true);
  assert.equal(widget.recorder.state, "recording");
  assert.equal(widget.messages.length, 0);
  assert.equal(widget.confirmations.length, 0);
  await act(async () => widget.bubble.onHoldEnd());
  assert.equal(widget.liveCaptions[0].stopped, true);
  assert.equal(widget.bubble.heard, "What is due");
  await act(async () => transcript.resolve({ transcript: "What is due today?" }));
  assert.equal(widget.bubble.heard, "What is due today?");
  assert.equal(widget.bubble.interimTranscript, false);
  assert.equal(widget.messages.length, 1);
  assert.equal(widget.messages[0].message, "What is due today?");
});

test("Caption failures preserve recording and closing voice ignores late caption responses", async (t) => {
  const widget = await mount(t, { closed: true });
  await widget.click("Talk to Lofty");
  const first = widget.liveCaptions[0];
  await act(async () => first.onUnavailable());
  assert.equal(widget.bubble.captionsUnavailable, true);
  assert.equal(widget.bubble.phase, "listening");
  assert.equal(widget.recorder.state, "recording");
  await widget.click("Close voice bubble");
  assert.equal(first.stopped, true);
  await widget.click("Talk to Lofty");
  await act(async () => first.onTranscript("Late previous recording"));
  assert.equal(widget.bubble.heard, "");
  assert.equal(widget.bubble.captionsUnavailable, false);
  assert.equal(widget.microphoneRequests, 2);
});

test("Mobile chat follows the visible keyboard area and removes viewport listeners on close", async (t) => {
  const listeners = new Map();
  const properties = new Map();
  let panelFocus = 0;
  let inputFocus = 0;
  const panel = { style: { setProperty: (key, value) => properties.set(key, value), removeProperty: (key) => properties.delete(key) }, dataset: {}, focus: () => panelFocus++ };
  const viewport = { height: 740, offsetTop: 0, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) };
  const widget = await mount(t, { touch: true, panel, input: { focus: () => inputFocus++ }, viewport });
  assert.equal(panelFocus, 1);
  assert.equal(inputFocus, 0);
  assert.equal(properties.get("--visible-height"), "740px");
  assert.equal(panel.dataset.compact, "false");
  viewport.height = 340;
  viewport.offsetTop = 45;
  await act(async () => listeners.get("resize")());
  assert.equal(properties.get("--visible-height"), "340px");
  assert.equal(properties.get("--visible-top"), "45px");
  assert.equal(panel.dataset.compact, "true");
  viewport.height = 740;
  viewport.offsetTop = 0;
  await act(async () => listeners.get("scroll")());
  assert.equal(panel.dataset.compact, "false");
  await widget.click("Close Lofty");
  assert.equal(listeners.size, 0);
  assert.equal(properties.size, 0);
});

test("Desktop chat still focuses the text composer", async (t) => {
  let inputFocus = 0;
  await mount(t, { input: { focus: () => inputFocus++ } });
  assert.equal(inputFocus, 1);
});

test("A focused popup field stays visible after keyboard resize and pending scroll work is cleaned up", async (t) => {
  const viewportListeners = new Map();
  const elementListeners = new Map();
  const frames = new Map();
  const scrolls = [];
  let frameId = 0;
  const field = { matches: (selector) => selector.includes("input"), scrollIntoView: (options) => scrolls.push(options) };
  const panel = { style: { setProperty() {}, removeProperty() {} }, dataset: {}, focus() {}, contains: (node) => node === field,
    addEventListener: (name, callback) => elementListeners.set(name, callback), removeEventListener: (name) => elementListeners.delete(name) };
  const viewport = { height: 740, offsetTop: 0, addEventListener: (name, callback) => viewportListeners.set(name, callback), removeEventListener: (name) => viewportListeners.delete(name) };
  const widget = await mount(t, { touch: true, panel, viewport, focusedField: field,
    requestAnimationFrame: (callback) => { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame: (id) => frames.delete(id) });
  viewport.height = 340;
  viewportListeners.get("resize")();
  assert.equal(frames.size, 1);
  const reveal = [...frames.values()][0]; frames.clear(); reveal();
  assert.equal(scrolls[0].block, "nearest");
  elementListeners.get("focusin")();
  assert.equal(frames.size, 1);
  await widget.click("Close Lofty");
  assert.equal(frames.size, 0);
  assert.equal(elementListeners.size, 0);
});

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

test("Lofty formats assistant paragraphs, emphasis and nested lists while user messages stay literal", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply });
  await widget.type("Keep **this** as typed.");
  await widget.submit();
  await act(async () => reply.resolve({
    reply: "## Today's plan\n\nStart with **priority work** and *take breaks*.\n\n1. Review tasks\n   - Check deadlines\n2. Plan the afternoon\n\nFinish on time.",
    actions: [],
  }));
  assert.ok(widget.view.root.findAllByType("h2").some((heading) => heading.children.join("") === "Today's plan"));
  assert.equal(widget.view.root.findByType("strong").children.join(""), "priority work");
  assert.equal(widget.view.root.findByType("em").children.join(""), "take breaks");
  assert.equal(widget.view.root.findAllByType("ol").length, 1);
  assert.equal(widget.view.root.findAllByType("ul").length, 1);
  assert.equal(widget.view.root.findAllByType("li").length, 3);
  const userMessage = widget.view.root.findAllByType("p").find((p) => p.children.includes("Keep **this** as typed."));
  assert.ok(userMessage);
  assert.equal(userMessage.findAllByType("strong").length, 0);
});

test("Streamed Markdown updates incomplete formatting and renders the final formatted reply once", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply });
  await widget.type("What should I do?");
  await widget.submit();
  await act(async () => widget.progress({ type: "delta", text: "Start with **priority" }));
  assert.ok(JSON.stringify(widget.view.toJSON()).includes("**priority"));
  await act(async () => widget.progress({ type: "delta", text: " work**." }));
  assert.equal(widget.view.root.findByType("strong").children.join(""), "priority work");
  await act(async () => reply.resolve({ reply: "Start with **priority work**.\n\nThen rest.", actions: [] }));
  assert.equal(widget.view.root.findAllByType("strong").length, 1);
  assert.ok(widget.view.root.findAllByType("p").some((p) => p.children.includes("Then rest.")));
});

test("Lofty renders tables, checklists and code with keyboard accessible scrolling", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply });
  await widget.type("Show a formatted example");
  await widget.submit();
  await act(async () => reply.resolve({
    reply: "| Task | Status |\n| --- | --- |\n| Review | Ready |\n\n- [x] Done\n- [ ] Pending\n\nUse `task_id`.\n\n```js\nconst value = '<safe>';\n// **keep literal**\n```",
    actions: [],
  }));
  assert.equal(widget.view.root.findByProps({ "aria-label": "Table in Lofty's reply" }).props.tabIndex, 0);
  assert.equal(widget.view.root.findAllByType("th").length, 2);
  assert.equal(widget.view.root.findAllByType("td").length, 2);
  const checkboxes = widget.view.root.findAllByType("input").filter((input) => input.props.type === "checkbox");
  assert.deepEqual(checkboxes.map((input) => input.props.checked), [true, false]);
  assert.ok(checkboxes.every((input) => input.props.disabled));
  const pre = widget.view.root.findByType("pre");
  assert.equal(pre.props.tabIndex, 0);
  assert.equal(pre.findByType("code").children.join(""), "const value = '<safe>';\n// **keep literal**\n");
  assert.equal(pre.findAllByType("strong").length, 0);
});

test("Formatted replies filter unsafe links and raw HTML without loading remote images", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply });
  await widget.type("Show links");
  await widget.submit();
  await act(async () => reply.resolve({
    reply: "[Docs](https://example.com/docs) and [unsafe](javascript:alert%281%29).\n\n<script>alert('unsafe')</script>\n\n<img src=x onerror=alert(1)>\n\n![Description](https://example.com/tracker.png)",
    actions: [],
  }));
  const link = widget.view.root.findAllByType("a").find((a) => a.props.href === "https://example.com/docs");
  assert.equal(link.props.target, "_blank");
  assert.equal(link.props.rel, "noopener noreferrer");
  assert.ok(widget.view.root.findAllByType("a").every((a) => !/^javascript:/i.test(a.props.href || "")));
  assert.equal(widget.view.root.findAllByType("script").length, 0);
  assert.equal(widget.view.root.findAllByType("img").length, 0);
  assert.ok(JSON.stringify(widget.view.toJSON()).includes("Description"));
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

test("Gateway outages show a friendly warning and a successful retry restores availability", async (t) => {
  for (const failure of [
    ...[502, 503, 504].map((status) => ({ response: { status } })),
    ...["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT"].map((code) => ({ code })),
  ]) {
    const reply = deferred();
    const overrides = { reply };
    const widget = await mount(t, overrides);
    await widget.type("Plan my day");
    await widget.submit();
    await act(async () => widget.progress({ type: "delta", text: "An unfinished answer" }));
    await act(async () => reply.reject(Object.assign(new Error("Check the gateway logs and OpenRouter key or credits."), failure)));

    const content = JSON.stringify(widget.view.toJSON());
    assert.match(content, /Lofty is temporarily unavailable/);
    assert.match(content, /Please try again in a moment/);
    assert.match(content, /You can keep using your workspace/);
    assert.doesNotMatch(content, /gateway logs|OpenRouter|An unfinished answer|Ready to ask/);
    assert.equal(widget.view.root.findAll((node) => node.props.role === "alert").length, 1);
    assert.equal(widget.view.root.findByType("input").props.value, "Plan my day");

    await widget.click("Close Lofty");
    await widget.click("Open Lofty");
    assert.match(JSON.stringify(widget.view.toJSON()), /Temporarily unavailable/);
    overrides.reply = null;
    await act(async () => widget.view.root.findAllByType("button").find((button) => button.children.includes("Try again")).props.onClick());
    assert.equal(widget.messages[1].message, "Plan my day");
    assert.equal(widget.messages[1].history.length, 0);
    assert.equal(widget.view.root.findByType("input").props.value, "");
    assert.match(JSON.stringify(widget.view.toJSON()), /Ready to ask/);
    assert.equal(widget.view.root.findAll((node) => node.props.role === "alert").length, 0);
  }
});

test("Permission and rate limit errors keep their specific messages", async (t) => {
  for (const status of [403, 429]) {
    const reply = deferred();
    const widget = await mount(t, { reply });
    await widget.type("Plan my day");
    await widget.submit();
    await act(async () => reply.reject(Object.assign(new Error("Please check your access or wait before sending another message."), { response: { status } })));
    const content = JSON.stringify(widget.view.toJSON());
    assert.match(content, /Please check your access or wait/);
    assert.match(content, /Ready to ask/);
    assert.doesNotMatch(content, /temporarily unavailable/);
  }
});

test("A successful voice question clears an earlier chat outage warning", async (t) => {
  const reply = deferred();
  const overrides = { reply };
  const widget = await mount(t, overrides);
  await widget.type("Plan my day");
  await widget.submit();
  await act(async () => reply.reject(Object.assign(new Error("Gateway unavailable"), { response: { status: 503 } })));
  overrides.reply = null;
  await widget.record();
  assert.match(JSON.stringify(widget.view.toJSON()), /Ready to ask/);
  assert.equal(widget.view.root.findAll((node) => node.props.role === "alert").length, 0);
});

test("Voice questions identify answer generation failures with chat closed", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply, closed: true });
  await widget.record();
  await act(async () => reply.reject(Object.assign(new Error("OpenClaw is unavailable. Check the gateway."), { response: { status: 503 } })));
  assert.equal(widget.bubble.phase, "error");
  assert.match(widget.bubble.error, /couldn't finish your answer/);
  assert.doesNotMatch(widget.bubble.error, /OpenClaw|gateway/);
  assert.equal(widget.bubble.canTalk, true);
  assert.equal(widget.speech.length, 0);
  await widget.click("Close voice bubble");
  await widget.click("Open Lofty");
  assert.match(JSON.stringify(widget.view.toJSON()), /Lofty is temporarily unavailable/);
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

const voiceTask = { id: "voice-task", kind: "task", token: "signed-voice-task", data: { workspaceId: "workspace", title: "Prepare launch", tier: "TIER_2", assigneeId: "tester" }, preview: { workspaceName: "Launch", people: [{ name: "Tester" }] } };
const priorityDetails = { id: "details-priority", kind: "task", prompt: "Choose a priority for the task.", fields: [{ name: "tier", label: "Priority", type: "select", required: true, options: [{ value: "TIER_2", label: "High" }] }] };

test("Voice confirmations save inside the voice popup, reject duplicate clicks and stay out of chat", async (t) => {
  const confirmation = deferred();
  const overrides = { closed: true, confirmation, reply: { promise: Promise.resolve({ reply: "Review and confirm below.", actions: [voiceTask] }) } };
  const widget = await mount(t, overrides);
  await widget.record();
  assert.equal(widget.view.root.findAllByProps({ id: "loft-assistant" }).length, 0);
  assert.equal(widget.confirmations.length, 0);
  const confirmButton = () => widget.view.root.findAllByType("button").find((button) => button.children.includes("Confirm") || button.children.includes("Saving…"));
  await act(async () => { void confirmButton().props.onClick(); void confirmButton().props.onClick(); });
  assert.deepEqual(widget.confirmations, ["signed-voice-task"]);
  assert.equal(confirmButton().props.disabled, true);
  await act(async () => confirmation.resolve({ id: "saved", workspaceId: "workspace" }));
  assert.match(JSON.stringify(widget.view.toJSON()), /Task saved/);
  assert.equal(widget.bubble.active, true);
  assert.equal(widget.view.root.findAllByProps({ id: "loft-assistant" }).length, 0);
  await widget.click("Close voice bubble");
  assert.equal(widget.view.root.findAllByProps({ id: "loft-assistant" }).length, 0);
  await widget.click("Open Lofty");
  assert.match(JSON.stringify(widget.view.toJSON()), /Task saved/);
});

test("Failed voice confirmation shows a retryable error on its preview and Dismiss stays in voice", async (t) => {
  const overrides = { closed: true, confirmationError: new Error("This action expired. Prepare it again."), reply: { promise: Promise.resolve({ reply: "Confirm below.", actions: [voiceTask] }) } };
  const widget = await mount(t, overrides);
  await widget.record();
  const button = (label) => widget.view.root.findAllByType("button").find((item) => item.children.includes(label));
  await act(async () => button("Confirm").props.onClick());
  assert.match(JSON.stringify(widget.view.toJSON()), /This action expired/);
  assert.equal(widget.bubble.active, true);
  assert.equal(widget.view.root.findAllByProps({ id: "loft-assistant" }).length, 0);
  await act(async () => button("Dismiss").props.onClick());
  assert.match(JSON.stringify(widget.view.toJSON()), /Dismissed/);
  assert.equal(widget.confirmations.length, 1);
});

test("Voice reply fields submit details in voice mode and require a separate exact-preview confirmation", async (t) => {
  const overrides = { closed: true, reply: { promise: Promise.resolve({ reply: "Choose a priority below.", actions: [], detailRequests: [priorityDetails] }) } };
  const widget = await mount(t, overrides);
  await widget.record();
  await act(async () => widget.view.root.findByType("select").props.onChange({ target: { value: "TIER_2" } }));
  overrides.reply = { promise: Promise.resolve({ reply: "Review your task below.", actions: [voiceTask] }) };
  await act(async () => widget.view.root.findByProps({ "aria-label": "Details for Lofty" }).props.onSubmit({ preventDefault() {} }));
  assert.equal(widget.messages.length, 2);
  assert.equal(widget.messages[1].interactionMode, "voice");
  assert.match(widget.messages[1].message, /Priority: High/);
  assert.equal(widget.confirmations.length, 0);
  assert.equal(widget.speech.length, 2);
  assert.equal(widget.bubble.active, true);
  assert.match(JSON.stringify(widget.view.toJSON()), /Details sent to Lofty/);
  assert.match(JSON.stringify(widget.view.toJSON()), /Create task/);
  assert.equal(widget.view.root.findAllByProps({ id: "loft-assistant" }).length, 0);
});

test("Text reply fields stay inline and preserve entered details when a follow-up fails", async (t) => {
  const nextReply = deferred();
  const overrides = { reply: { promise: Promise.resolve({ reply: "Choose the priority below.", actions: [], detailRequests: [priorityDetails] }) } };
  const widget = await mount(t, overrides);
  await widget.type("Create a task"); await widget.submit();
  const form = () => widget.view.root.findByProps({ "aria-label": "Details for Lofty" });
  await act(async () => form().props.onSubmit({ preventDefault() {} }));
  assert.equal(widget.messages.length, 1);
  assert.match(JSON.stringify(widget.view.toJSON()), /complete the requested details/);
  await act(async () => widget.view.root.findByType("select").props.onChange({ target: { value: "TIER_2" } }));
  overrides.reply = nextReply;
  await act(async () => { void form().props.onSubmit({ preventDefault() {} }); });
  assert.equal(widget.messages[1].interactionMode, "text");
  await act(async () => nextReply.reject(new Error("Network unavailable")));
  assert.equal(widget.view.root.findByType("select").props.value, "TIER_2");
  assert.match(JSON.stringify(widget.view.toJSON()), /details could not be sent/);
  assert.equal(widget.speech.length, 0);
  assert.equal(widget.confirmations.length, 0);
});

test("Meeting reply fields validate times, collect attendees and send explicit offset dates", async (t) => {
  const fields = [
    { name: "startTime", label: "Start date and time", type: "datetime-local", required: true },
    { name: "endTime", label: "End date and time", type: "datetime-local", required: true },
    { name: "attendeeIds", label: "Attendees", type: "multiselect", required: true, options: [{ value: "partner", label: "Partner" }] },
  ];
  const overrides = { reply: { promise: Promise.resolve({ reply: "Add the meeting details below.", actions: [], detailRequests: [{ id: "meeting-details", kind: "event", prompt: "When, and with whom?", fields }] }) } };
  const widget = await mount(t, overrides);
  await widget.type("Set up a meeting"); await widget.submit();
  const form = () => widget.view.root.findByProps({ "aria-label": "Details for Lofty" });
  const date = async (index, value) => { await act(async () => form().findAllByType("input").filter((input) => input.props.type === "datetime-local")[index].props.onChange({ target: { value } })); };
  await date(0, "2026-10-20T11:00"); await date(1, "2026-10-20T10:00");
  await act(async () => form().findByProps({ type: "checkbox" }).props.onChange({ target: { checked: true } }));
  await act(async () => form().props.onSubmit({ preventDefault() {} }));
  assert.match(JSON.stringify(widget.view.toJSON()), /End time must be after start time/);
  assert.equal(widget.messages.length, 1);
  await date(1, "2026-10-20T12:00");
  overrides.reply = { promise: Promise.resolve({ reply: "Review the meeting preview.", actions: [] }) };
  await act(async () => form().props.onSubmit({ preventDefault() {} }));
  assert.equal(widget.messages.length, 2);
  assert.match(widget.messages[1].message, /Start date and time: \d{4}-\d\d-\d\dT\d\d:\d\d:00.000Z/);
  assert.match(widget.messages[1].message, /Attendees: Partner \(partner\)/);
  assert.equal(widget.confirmations.length, 0);
});

test("Deferred task previews disclose the default priority and unassigned state", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply });
  await widget.type("Create a task; I'll add its details later.");
  await widget.submit();
  await act(async () => reply.resolve({ reply: "Confirm below.", actions: [{ id: "proposal", kind: "task", data: { title: "Untitled task", workspaceId: "workspace", tier: "TIER_3", assigneeId: null, deferredFields: ["title", "tier", "assigneeId"] } }] }));
  const content = JSON.stringify(widget.view.toJSON());
  assert.match(content, /Medium/);
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

test("Speech gateway outages and timeouts preserve the answer and let Retry audio retry only synthesis", async (t) => {
  for (const failure of [{ response: { status: 502 } }, { response: { status: 503 } }, { response: { status: 504 } }, { code: "ECONNABORTED" }]) {
    const overrides = { speechError: Object.assign(new Error("Private gateway details"), failure) };
    const widget = await mount(t, overrides);
    await widget.record();
    assert.equal(widget.bubble.phase, "error");
    assert.match(widget.bubble.error, /voice audio.*Retry audio/);
    assert.doesNotMatch(widget.bubble.error, /Private gateway|trouble connecting to the AI/);
    assert.equal(widget.bubble.canPlay, true);
    if (failure.response?.status === 504 || failure.code === "ECONNABORTED") assert.match(widget.bubble.error, /took too long/);
    overrides.speechError = null;
    await widget.click("Retry voice reply");
    assert.equal(widget.messages.length, 1);
    assert.equal(widget.speech.length, 2);
    assert.equal(widget.audio[0].played, true);
  }
});

test("Transcription failures identify the recording stage before requesting an answer", async (t) => {
  const transcript = deferred();
  const widget = await mount(t, { transcript });
  await widget.record();
  assert.equal(widget.bubble.transcribing, true);
  await act(async () => transcript.reject(Object.assign(new Error("Private provider details"), { response: { status: 503 } })));
  assert.match(widget.bubble.error, /couldn't turn your recording into text/);
  assert.doesNotMatch(widget.bubble.error, /Private provider|trouble connecting to the AI/);
  assert.equal(widget.messages.length, 0);
  assert.equal(widget.speech.length, 0);
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

test("Task and event update action cards display before/after changes and confirm cleanly", async (t) => {
  const reply = deferred();
  const widget = await mount(t, { reply });
  await widget.type("Update the task priority and summarize the doc");
  await widget.submit();
  await act(async () => reply.resolve({
    reply: "Here is the update preview.\n\nSources: [Launch Plan](/workspaces/workspace/docs/doc-1)",
    actions: [{
      id: "update-1",
      token: "signed-task-update",
      kind: "task_update",
      data: {
        workspaceId: "workspace",
        recordId: "task-1",
        before: { tier: "TIER_3" },
        changes: { tier: "TIER_1" },
      },
      preview: { title: "Ship release", workspaceName: "Launch" },
    }],
  }));
  const content = JSON.stringify(widget.view.toJSON());
  assert.match(content, /Update task/);
  assert.match(content, /Ship release/);
  assert.match(content, /"Medium"," → ","Urgent"/);
  await act(async () => widget.view.root.findAllByType("button").find((b) => b.children.includes("Confirm")).props.onClick());
  assert.deepEqual(widget.confirmations, ["signed-task-update"]);
});


import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";
import { build } from "esbuild";

async function bundle(path) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", external: ["react", "react/jsx-runtime"], plugins: [{ name: "services", setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === "entry-point" || ["react", "react/jsx-runtime"].includes(path) || path.endsWith("/meetings.js")) return;
      return { path, namespace: "mock" };
    });
    builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: `module.exports = globalThis.mocks[${JSON.stringify(path.split("/").at(-1))}];`, loader: "js" }));
  } }] });
  return result.outputFiles[0].text;
}
const providerCode = await bundle("../src/context/MeetingContext.jsx");
const scheduleCode = await bundle("../src/components/meeting/ScheduleMeetingModal.jsx");
const noop = () => null;
const icons = { PhoneOff: noop, Check: noop, Clock3: noop, Video: noop };
const Modal = ({ open, children, onClose }) => open ? React.createElement("section", { "data-modal": true, onClose }, children) : null;
const defer = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
function load(code, mocks, globals = {}) { const module = { exports: {} }; vm.runInNewContext(code, { module, require: createRequire(import.meta.url), mocks, setTimeout, clearTimeout, ...globals }); return module.exports; }
let streamId = 0;
class Stream {
  constructor(tracks = []) { this.id = `stream-${++streamId}`; this.tracks = [...tracks]; }
  getTracks() { return [...this.tracks]; }
  getAudioTracks() { return this.tracks.filter((track) => track.kind === "audio"); }
  getVideoTracks() { return this.tracks.filter((track) => track.kind === "video"); }
  addTrack(track) { this.tracks.push(track); }
}
function track(kind) { return { kind, enabled: true, readyState: "live", stop() { this.readyState = "ended"; } }; }
async function mountMeeting(t, options = {}) {
  const sent = [], handlers = new Map(), requests = [], peers = [];
  const socket = { connected: true, emit(event, data, ack) { sent.push({ event, data, ack }); }, on(event, fn) { handlers.set(event, fn); }, off(event, fn) { if (handlers.get(event) === fn) handlers.delete(event); } };
  const userState = { user: { id: "self", name: "Alex" } };
  class Peer {
    constructor() { this.transceivers = []; this.tracks = []; peers.push(this); }
    addTransceiver(kind, options) { this.transceivers.push({ kind, ...options }); }
    addTrack(track, stream) { this.tracks.push({ track, stream }); return {}; }
    close() { this.closed = true; }
    async createOffer() { return { type: "offer", sdp: "mock" }; }
    async createAnswer() { return { type: "answer", sdp: "mock" }; }
    async setLocalDescription(description) { this.localDescription = description; }
    async setRemoteDescription(description) { this.remoteDescription = description; }
  }
  const exported = load(providerCode, { "lucide-react": icons, "SocketContext.jsx": { useSocket: () => ({ socket }) }, "AuthContext.jsx": { useAuth: () => userState }, "useSpeakingDetection.js": { useSpeakingDetection: () => new Set() }, "Modal.jsx": Modal }, { MediaStream: Stream, RTCPeerConnection: Peer, RTCSessionDescription: function (value) { return value; }, navigator: { mediaDevices: { getUserMedia: async (devices) => {
    requests.push(devices); return options.acquire ? options.acquire(devices) : new Stream(Object.keys(devices).filter((key) => devices[key]).map((kind) => track(kind)));
  }, getDisplayMedia: options.display || (async () => new Stream([track("video")])) } } });
  let state, view;
  function Consumer() { state = exported.useMeeting(); return null; }
  const render = () => React.createElement(exported.MeetingProvider, null, React.createElement(Consumer));
  await act(async () => { view = create(render()); });
  t.after(() => act(() => view.unmount()));
  const prepare = async (devices) => { await act(async () => state.promptJoin("team")); await act(async () => state.confirmDevices(devices)); };
  const join = async (peerList = []) => { await act(async () => state.confirmJoin()); await act(async () => sent.findLast((message) => message.event === "meeting:join").ack({ peers: peerList })); };
  return { get state() { return state; }, view, socket, sent, requests, peers, prepare, join, userState, rerender: async () => act(async () => view.update(render())), fire: async (event, data) => act(async () => handlers.get(event)?.(data)) };
}

test("audio-only and device-free joins request only the chosen devices", async (t) => {
  const call = await mountMeeting(t);
  await call.prepare({ video: false, audio: true });
  assert.equal(call.state.camOn, false); assert.equal(call.state.micOn, true);
  assert.equal(call.requests.length, 1); assert.equal(call.requests[0].video, false);
  const audio = call.state.localStream.getAudioTracks()[0];
  await act(async () => call.state.cancelPrepare()); assert.equal(audio.readyState, "ended");
  await call.prepare({ video: false, audio: false });
  assert.equal(call.requests.length, 1); assert.equal(call.state.localStream.getTracks().length, 0);
  await call.join([{ userId: "peer", name: "Riley" }]);
  assert.equal(call.state.joined, true); assert.ok(call.state.joinedAt);
  assert.deepEqual(call.peers[0].transceivers.map((item) => item.kind), ["audio", "video"]);
  assert.equal(call.sent.find((item) => item.event === "meeting:media-state").data.micOn, false);
});

test("devices can be enabled later and are negotiated with existing peers", async (t) => {
  const call = await mountMeeting(t); await call.prepare({ video: false, audio: false }); await call.join([{ userId: "peer", name: "Riley" }]);
  await act(async () => call.state.toggleCam());
  assert.equal(call.state.camOn, true); assert.equal(call.state.localStream.getVideoTracks().length, 1);
  await act(async () => call.state.confirmEnableMic());
  assert.equal(call.state.micOn, true); assert.equal(call.state.micAvailable, true);
  assert.deepEqual(call.peers[0].tracks.map((item) => item.track.kind), ["video", "audio"]);
  assert.equal(call.peers[0].tracks[0].stream.id, call.peers[0].tracks[1].stream.id);
  await act(async () => call.state.toggleCam()); assert.equal(call.state.camOn, false);
  assert.equal(call.requests.length, 2);
});

test("late device permission results are released after cancel or logout", async (t) => {
  const pending = defer(); const call = await mountMeeting(t, { acquire: () => pending.promise });
  await act(async () => call.state.promptJoin("team"));
  let request; await act(async () => { request = call.state.confirmDevices({ video: true, audio: true }); });
  await act(async () => call.state.cancelPrepare());
  const acquired = new Stream([track("video"), track("audio")]);
  await act(async () => { pending.resolve(acquired); await request; });
  assert.equal(call.state.lobbyOpen, false); assert.equal(call.state.localStream, null);
  assert.ok(acquired.getTracks().every((item) => item.readyState === "ended"));
});

test("an in-call device request is deduplicated and cannot reopen a departed call", async (t) => {
  const pending = defer(); const call = await mountMeeting(t, { acquire: () => pending.promise });
  await call.prepare({ video: false, audio: false }); await call.join();
  let request; await act(async () => { request = call.state.toggleCam(); call.state.toggleCam(); });
  assert.equal(call.requests.length, 1); assert.equal(call.state.deviceBusy, true);
  await act(async () => call.state.leaveMeeting());
  const acquired = new Stream([track("video")]);
  await act(async () => { pending.resolve(acquired); await request; });
  assert.equal(call.state.joined, false); assert.equal(call.state.localStream, null);
  assert.equal(acquired.getTracks()[0].readyState, "ended");
});

test("permission denial leaves a working path to join with devices off", async (t) => {
  const call = await mountMeeting(t, { acquire: async () => { throw Error("Denied"); } });
  await call.prepare({ video: true, audio: true });
  assert.equal(call.state.joining, false); assert.match(call.state.error, /devices/);
  await call.prepare({ video: false, audio: false }); await call.join(); assert.equal(call.state.joined, true);
});

test("screen-share streams are identified even when the presenter has no camera tracks", async (t) => {
  const call = await mountMeeting(t); await call.prepare({ video: false, audio: false }); await call.join();
  await call.fire("meeting:signal", { fromUserId: "peer", data: { type: "offer", sdp: {}, cameraStreamId: "camera-id", screenStreamId: "screen-id" } });
  const screen = new Stream([track("video")]); screen.id = "screen-id";
  await act(async () => call.peers[0].ontrack({ streams: [screen] }));
  assert.equal(call.state.remoteScreenStreams.peer, screen); assert.equal(call.state.remoteStreams.peer, undefined);
});

test("a screen picker resolved after leaving releases its stream", async (t) => {
  const pending = defer(); const call = await mountMeeting(t, { display: () => pending.promise }); await call.prepare({ video: false, audio: false }); await call.join();
  let request; await act(async () => { request = call.state.startScreenShare(); });
  await act(async () => call.state.leaveMeeting());
  const screen = new Stream([track("video")]);
  await act(async () => { pending.resolve(screen); await request; });
  assert.equal(screen.getTracks()[0].readyState, "ended"); assert.equal(call.state.sharingScreen, false);
});

async function mountSchedule(t, options = {}) {
  const writes = [], saves = [], members = [{ user: { id: "self", name: "Alex" } }, { user: { id: "other", name: "Riley" } }];
  const component = load(scheduleCode, { "lucide-react": icons, "Modal.jsx": Modal, "client.js": { apiErrorMessage: (error) => error.message }, "DatePicker.jsx": { DateTimePicker: ({ onChange, ...props }) => React.createElement("input", { ...props, type: "datetime-local", onChange: (event) => onChange(event.target.value) }) }, "workspaces.js": { getWorkspace: async () => ({ members }) }, "events.js": { createEvent: async (workspace, data) => { writes.push({ workspace, data }); return options.save ? options.save(data) : { id: "new", ...data }; }, updateEvent: async (workspace, id, data) => { writes.push({ workspace, id, data }); return { id, ...data }; } } }).default;
  let view; const props = { open: true, onClose: noop, workspaceId: "team", meetLink: "https://app.test/workspaces/team/meeting", onSaved: (data) => saves.push(data), ...options.props };
  await act(async () => { view = create(React.createElement(component, props)); });
  t.after(() => act(() => view.unmount()));
  const input = (id) => view.root.findAll((node) => (node.type === "input" || node.type === "textarea") && node.props.id === id)[0];
  const fill = async (id, value) => act(async () => input(id).props.onChange({ target: { value } }));
  const submit = async () => act(async () => view.root.findByType("form").props.onSubmit({ preventDefault() {} }));
  const textOf = (item) => typeof item === "string" ? item : item.children.map(textOf).join("");
  const button = (text) => view.root.findAllByType("button").find((item) => textOf(item) === text);
  return { view, writes, saves, input, fill, submit, button, props, rerender: async () => act(async () => view.update(React.createElement(component, props))) };
}

test("scheduling adjusts end time with duration, selects attendees and trims the agenda", async (t) => {
  const modal = await mountSchedule(t);
  await modal.fill("meeting-title", "  Planning  "); await modal.fill("meeting-agenda", "  Roadmap review  ");
  await act(async () => modal.button("45 min").props.onClick());
  await modal.fill("meeting-starts", "2099-10-12T08:00");
  assert.equal(modal.input("meeting-ends").props.value, "2099-10-12T08:45");
  await act(async () => modal.view.root.findAllByType("input").find((item) => item.props.type === "checkbox").props.onChange({ target: { checked: false } }));
  await modal.submit(); assert.equal(modal.writes.length, 0); assert.match(modal.view.root.findByProps({ role: "alert" }).children.join(""), /attendee/);
  await act(async () => modal.view.root.findAllByType("label").find((item) => item.children.includes("Alex")).findByType("input").props.onChange());
  await modal.submit(); assert.equal(modal.writes[0].data.title, "Planning"); assert.equal(modal.writes[0].data.description, "Roadmap review"); assert.equal(modal.writes[0].data.attendeeIds.length, 1); assert.equal(modal.saves.length, 1);
});

test("scheduling rejects reversed times, deduplicates saves and retains inputs on failure", async (t) => {
  const pending = defer(); const modal = await mountSchedule(t, { save: () => pending.promise });
  await modal.fill("meeting-title", "Team sync"); await modal.fill("meeting-starts", "2099-10-12T08:00"); await modal.fill("meeting-ends", "2099-10-12T07:00");
  await modal.submit(); assert.equal(modal.writes.length, 0);
  await modal.fill("meeting-ends", "2099-10-12T08:30");
  let request; await act(async () => { request = modal.view.root.findByType("form").props.onSubmit({ preventDefault() {} }); modal.view.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
  assert.equal(modal.writes.length, 1);
  await act(async () => { pending.reject(Error("Unavailable")); await request; });
  assert.equal(modal.input("meeting-title").props.value, "Team sync"); assert.equal(modal.button("Schedule meeting").props.disabled, false);
});

test("a schedule result cannot update a different workspace after navigation", async (t) => {
  const pending = defer(); const modal = await mountSchedule(t, { save: () => pending.promise });
  await modal.fill("meeting-title", "Team sync");
  let request; await act(async () => { request = modal.view.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
  modal.props.workspaceId = "other"; await modal.rerender();
  await act(async () => { pending.resolve({ id: "new" }); await request; });
  assert.equal(modal.saves.length, 0); assert.equal(modal.input("meeting-title").props.value, "");
});

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";
import { build } from "esbuild";

async function bundle(path) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(path, import.meta.url))],
    bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
    external: ["react", "react/jsx-runtime"],
    define: { "import.meta.env.VITE_REALTIME_URL": '"https://realtime.example"' },
    plugins: [{ name: "dependencies", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
        if (kind === "entry-point" || path === "react" || path === "react/jsx-runtime") return;
        return { path, namespace: "mock" };
      });
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({
        contents: `module.exports = globalThis.mocks[${JSON.stringify(path)}];`, loader: "js",
      }));
    } }],
  });
  return result.outputFiles[0].text;
}

const chatCode = await bundle("../src/components/chat/ChatThread.jsx");
const meetingCode = await bundle("../src/context/MeetingContext.jsx");
const socketCode = await bundle("../src/context/SocketContext.jsx");
const noop = () => null;
const icons = Object.fromEntries(["MessageCircle", "MessageSquare", "Paperclip", "Smile", "Trash2", "X", "File", "Film", "Image", "Music", "FileText", "PhoneOff"].map((name) => [name, noop]));
const user = { id: "self", name: "Tester" };

function socketMock(connected = true) {
  const handlers = new Map();
  const sent = [];
  return {
    connected, sent,
    on(event, fn) { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event).add(fn); },
    off(event, fn) { handlers.get(event)?.delete(fn); },
    emit(event, data, ack) { sent.push({ event, data, ack }); },
    fire(event, data) { for (const fn of handlers.get(event) || []) fn(data); },
  };
}

function load(code, mocks, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(code, { module, require: createRequire(import.meta.url), mocks, setTimeout, clearTimeout, ...globals });
  return module.exports;
}

async function mountChat(t, connected = true, initialHistory = []) {
  const socket = socketMock(connected);
  let loads = 0;
  let history = initialHistory;
  const component = load(chatCode, {
    "lucide-react": icons,
    "../../api/messages.js": { getMessages: async () => { loads++; return history; } },
    "../../api/assets.js": {},
    "../../api/client.js": { apiErrorMessage: (err) => err.message },
    "../../context/AuthContext.jsx": { useAuth: () => ({ user }) },
    "../../context/SocketContext.jsx": { useSocket: () => ({ socket, connected: socket.connected }) },
    "../../context/WorkspaceContext.jsx": { useWorkspaces: () => ({ workspaces: [] }) },
    "../../context/ConfirmContext.jsx": { useConfirm: () => noop },
    "../../context/MemberProfileContext.jsx": { useMemberProfile: () => noop },
    "../common/Avatar.jsx": noop, "../common/EmptyState.jsx": noop, "../common/Spinner.jsx": noop,
    "../storage/PreviewModal.jsx": noop, "../storage/UploadProgressPanel.jsx": noop, "./EmojiPicker.jsx": noop,
    "../../lib/colors.js": { displayColor: () => "", textOn: () => "" },
    "../../hooks/useMediaQuery.js": () => true,
    "../../lib/access.js": { can: () => false },
    "../../lib/uploads.js": { ACCEPTED_UPLOAD_TYPES: "" },
  }).default;
  let view;
  const conversation = { id: "chat", title: "General", isGroup: true, participants: [] };
  await act(async () => { view = create(React.createElement(component, { conversation })); });
  t.after(() => act(() => view.unmount()));
  const input = () => view.root.findAllByType("input").find((node) => "value" in node.props);
  return {
    socket, view, input, get loads() { return loads; },
    setHistory(messages) { history = messages; },
    type: async (value) => act(async () => input().props.onChange({ target: { value, selectionStart: value.length } })),
    submit: async () => act(async () => view.root.findByType("form").props.onSubmit({ preventDefault() {} })),
    ack: async (data) => act(async () => socket.sent.find((item) => item.event === "message:send").ack(data)),
  };
}

test("chat keeps the draft when disconnected and displays the reason", async (t) => {
  const chat = await mountChat(t, false);
  await chat.type("Keep my message");
  await chat.submit();
  assert.equal(chat.input().props.value, "Keep my message");
  assert.equal(chat.socket.sent.filter((item) => item.event === "message:send").length, 0);
  assert.match(chat.view.root.findByProps({ role: "alert" }).children.join(""), /unavailable/);
});

test("chat keeps the draft until acknowledgement and retains it on failure", async (t) => {
  const chat = await mountChat(t);
  await chat.type("Please deliver");
  await chat.submit();
  await chat.submit();
  assert.equal(chat.socket.sent.filter((item) => item.event === "message:send").length, 1);
  assert.equal(chat.input().props.value, "Please deliver");
  assert.equal(chat.input().props.disabled, true);
  await chat.ack({ error: "Connection lost" });
  assert.equal(chat.input().props.value, "Please deliver");
  assert.equal(chat.input().props.disabled, false);
  assert.equal(chat.view.root.findByProps({ role: "alert" }).children.join(""), "Connection lost");
});

test("confirmed chat messages appear once even when broadcast and ack both arrive", async (t) => {
  const chat = await mountChat(t);
  await chat.type("Delivered");
  await chat.submit();
  const message = { id: "saved", conversationId: "chat", content: "Delivered", sender: user, createdAt: new Date().toISOString(), reactions: [] };
  await act(async () => chat.socket.fire("message:new", message));
  await chat.ack({ message });
  assert.equal(chat.input().props.value, "");
  assert.equal(chat.view.root.findAllByType("p").filter((p) => p.children.includes("Delivered")).length, 1);
});

test("chat rejoins its room and reloads missed history after reconnecting", async (t) => {
  const chat = await mountChat(t);
  await chat.type("Unsent draft");
  const before = chat.loads;
  await act(async () => chat.socket.fire("connect"));
  assert.equal(chat.loads, before + 1);
  assert.equal(chat.socket.sent.filter((item) => item.event === "conversation:join").length, 2);
  assert.equal(chat.input().props.value, "Unsent draft");
});

test("reconnect removes messages that were deleted while the client was offline", async (t) => {
  const message = { id: "deleted", conversationId: "chat", content: "Removed while offline", sender: user, createdAt: new Date().toISOString(), reactions: [] };
  const chat = await mountChat(t, true, [message]);
  assert.equal(chat.view.root.findAllByType("p").filter((p) => p.children.includes(message.content)).length, 1);
  chat.setHistory([]);
  await act(async () => chat.socket.fire("connect"));
  assert.equal(chat.view.root.findAllByType("p").filter((p) => p.children.includes(message.content)).length, 0);
});

async function mountMeeting(t) {
  const socket = socketMock();
  let stopped = 0;
  const stream = { getTracks: () => [{ stop: () => stopped++ }] };
  const exported = load(meetingCode, {
    "lucide-react": icons,
    "./SocketContext.jsx": { useSocket: () => ({ socket }) },
    "./AuthContext.jsx": { useAuth: () => ({ user }) },
    "../hooks/useSpeakingDetection.js": { useSpeakingDetection: () => ({}) },
    "../components/common/Modal.jsx": noop,
  }, { navigator: { mediaDevices: { getUserMedia: async () => stream } } });
  let state, view;
  function Consumer() { state = exported.useMeeting(); return null; }
  await act(async () => { view = create(React.createElement(exported.MeetingProvider, null, React.createElement(Consumer))); });
  t.after(() => act(() => view.unmount()));
  await act(async () => state.promptJoin("workspace"));
  await act(async () => state.confirmDevices(false));
  return { socket, get state() { return state; }, get stopped() { return stopped; } };
}

test("meeting refuses a disconnected join and keeps the lobby available to retry", async (t) => {
  const meeting = await mountMeeting(t);
  meeting.socket.connected = false;
  await act(async () => meeting.state.confirmJoin());
  assert.equal(meeting.state.joining, false);
  assert.equal(meeting.state.lobbyOpen, true);
  assert.match(meeting.state.error, /unavailable/);
});

test("meeting join failure stops the spinner and cleans up uncertain membership", async (t) => {
  const meeting = await mountMeeting(t);
  await act(async () => meeting.state.confirmJoin());
  assert.equal(meeting.state.joining, true);
  await act(async () => meeting.socket.sent.find((item) => item.event === "meeting:join").ack({ error: "No response" }));
  assert.equal(meeting.state.joining, false);
  assert.equal(meeting.state.joined, false);
  assert.equal(meeting.state.lobbyOpen, true);
  assert.ok(meeting.socket.sent.some((item) => item.event === "meeting:leave"));
});

test("a dropped meeting connection releases devices and returns to the join screen", async (t) => {
  const meeting = await mountMeeting(t);
  await act(async () => meeting.state.confirmJoin());
  await act(async () => meeting.socket.sent.find((item) => item.event === "meeting:join").ack({ peers: [] }));
  assert.equal(meeting.state.joined, true);
  meeting.socket.connected = false;
  await act(async () => meeting.socket.fire("disconnect"));
  assert.equal(meeting.state.joined, false);
  assert.equal(meeting.state.localStream, null);
  assert.equal(meeting.stopped, 1);
  assert.match(meeting.state.error, /connection was lost/);
});

test("socket context publishes a connecting socket and ignores a prior account's late disconnect", async (t) => {
  let currentUser = user;
  const sockets = [];
  const exported = load(socketCode, {
    "../lib/socketShim.js": { SocketLike: class {
      constructor() { const socket = socketMock(false); socket.disconnect = noop; sockets.push(socket); return socket; }
    } },
    "./AuthContext.jsx": { useAuth: () => ({ user: currentUser }) },
  }, { localStorage: { getItem: () => "test-token" } });
  let state, view;
  function Consumer() { state = exported.useSocket(); return null; }
  const tree = () => React.createElement(exported.SocketProvider, null, React.createElement(Consumer));
  await act(async () => { view = create(tree()); });
  t.after(() => act(() => view.unmount()));
  assert.equal(state.socket, sockets[0]);
  assert.equal(state.connected, false);
  await act(async () => sockets[0].fire("connect"));
  assert.equal(state.connected, true);
  currentUser = { id: "second-user" };
  await act(async () => view.update(tree()));
  await act(async () => sockets[1].fire("connect"));
  await act(async () => sockets[0].fire("disconnect"));
  assert.equal(state.socket, sockets[1]);
  assert.equal(state.connected, true);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";
import { build } from "esbuild";
import * as chatHelpers from "../src/lib/chat.js";

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
const icons = Object.fromEntries(["MessageCircle", "MessageSquare", "Paperclip", "Smile", "Trash2", "X", "File", "Film", "Image", "Music", "FileText", "PhoneOff", "Search", "ArrowDown", "Users", "Copy"].map((name) => [name, noop]));
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

async function mountChat(t, connected = true, initialHistory = [], options = {}) {
  const socket = socketMock(connected);
  let loads = 0;
  let history = initialHistory;
  const requests = [];
  const storage = options.storage || new Map();
  const container = { scrollHeight: 1200, clientHeight: 400, scrollTop: 800, scrollTo({ top }) { this.scrollTop = top; } };
  const component = load(chatCode, {
    "lucide-react": icons,
    "../../api/messages.js": { getMessagePage: async (id, params) => {
      loads++; requests.push(params);
      if (options.getPage) return options.getPage(id, params);
      return { messages: history, nextCursor: null };
    } },
    "../../api/assets.js": {},
    "../../api/client.js": { apiErrorMessage: (err) => err.message },
    "../../context/AuthContext.jsx": { useAuth: () => ({ user }) },
    "../../context/SocketContext.jsx": { useSocket: () => ({ socket, connected: socket.connected }) },
    "../../context/WorkspaceContext.jsx": { useWorkspaces: () => ({ workspaces: [] }) },
    "../../context/ConfirmContext.jsx": { useConfirm: () => noop },
    "../../context/MemberProfileContext.jsx": { useMemberProfile: () => noop },
    "../common/Avatar.jsx": noop, "../common/EmptyState.jsx": noop, "../common/Spinner.jsx": noop, "../common/Modal.jsx": noop,
    "../storage/PreviewModal.jsx": noop, "../storage/UploadProgressPanel.jsx": noop, "./EmojiPicker.jsx": noop,
    "../../lib/colors.js": { displayColor: () => "", textOn: () => "" },
    "../../hooks/useMediaQuery.js": () => true,
    "../../lib/access.js": { can: () => false },
    "../../lib/uploads.js": { ACCEPTED_UPLOAD_TYPES: "" },
    "../../lib/chat.js": { ...chatHelpers,
      readChatDraft: (userId, conversationId) => storage.get(`${userId}:${conversationId}`) || "",
      saveChatDraft: (userId, conversationId, value) => value ? storage.set(`${userId}:${conversationId}`, value) : storage.delete(`${userId}:${conversationId}`),
    },
  }, { requestAnimationFrame: (fn) => fn() }).default;
  let view;
  const conversation = { id: "chat", title: "General", isGroup: true, participants: [] };
  await act(async () => { view = create(React.createElement(component, { conversation }), {
    createNodeMock: (element) => element.props.role === "log" ? container : null,
  }); });
  t.after(() => act(() => view.unmount()));
  const input = () => view.root.findByType("textarea");
  return {
    socket, view, input, requests, storage, container, get loads() { return loads; },
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

test("chat sends on Enter, preserves Shift+Enter, and respects IME composition", async (t) => {
  const chat = await mountChat(t);
  await chat.type("First line\nSecond line");
  let prevented = 0;
  const key = (extra) => ({ key: "Enter", preventDefault() { prevented++; }, ...extra });
  await act(async () => chat.input().props.onKeyDown(key({ shiftKey: true })));
  await act(async () => chat.input().props.onKeyDown(key({ nativeEvent: { isComposing: true } })));
  assert.equal(prevented, 0);
  assert.equal(chat.socket.sent.filter((item) => item.event === "message:send").length, 0);
  await act(async () => chat.input().props.onKeyDown(key({ shiftKey: false })));
  assert.equal(prevented, 1);
  assert.equal(chat.socket.sent.find((item) => item.event === "message:send").data.content, "First line\nSecond line");
});

test("chat restores its own draft on reopening and removes it only after delivery", async (t) => {
  const storage = new Map([["self:another-chat", "Another conversation's draft"]]);
  const first = await mountChat(t, true, [], { storage });
  await first.type("Save for later");
  await act(async () => first.view.unmount());
  const second = await mountChat(t, true, [], { storage });
  assert.equal(second.input().props.value, "Save for later");
  await second.submit();
  await second.ack({ message: { id: "saved", content: "Save for later", createdAt: new Date().toISOString(), sender: user } });
  assert.equal(storage.has("self:chat"), false);
  assert.equal(storage.get("self:another-chat"), "Another conversation's draft");
});

test("older chat pages merge in order without duplicating boundary messages", async (t) => {
  const message = (id, day) => ({ id, content: id, createdAt: `2026-10-${day}T10:00:00.000Z`, sender: user });
  const chat = await mountChat(t, true, [], { getPage: async (_, params) => params.before
    ? { messages: [message("older", "10"), message("latest", "11")], nextCursor: null }
    : { messages: [message("latest", "11")], nextCursor: "previous-page" } });
  await chat.type("Unsent while reading");
  await act(async () => chat.view.root.findAllByType("button").find((button) => button.children.includes("Load older messages")).props.onClick());
  assert.equal(chat.requests[1].before, "previous-page");
  assert.deepEqual(chat.view.root.findAll((node) => node.props["data-message-id"]).map((node) => node.props["data-message-id"]), ["older", "latest"]);
  assert.equal(chat.input().props.value, "Unsent while reading");
});

test("incoming messages leave an older reading position intact until jumping to latest", async (t) => {
  const chat = await mountChat(t);
  chat.container.scrollTop = 100;
  await act(async () => chat.view.root.findByProps({ role: "log" }).props.onScroll({ currentTarget: chat.container }));
  const incoming = { id: "incoming", conversationId: "chat", content: "New arrival", createdAt: new Date().toISOString(), sender: { id: "other", name: "Riley" } };
  await act(async () => chat.socket.fire("message:new", incoming));
  await act(async () => chat.socket.fire("message:new", incoming));
  assert.equal(chat.container.scrollTop, 100);
  const button = chat.view.root.findAllByType("button").find((node) => node.children.includes("1 new message"));
  assert.ok(button);
  await act(async () => button.props.onClick());
  assert.equal(chat.container.scrollTop, chat.container.scrollHeight);
});

test("message search queries the server and keeps live messages out of filtered results", async (t) => {
  const old = { id: "old", content: "Archived launch notes", createdAt: "2025-01-01T10:00:00.000Z", sender: user };
  const chat = await mountChat(t, true, [], { getPage: async (_, params) => ({ messages: params.q ? [old] : [], nextCursor: null }) });
  await act(async () => chat.view.root.findByProps({ "aria-label": "Search messages" }).props.onClick());
  await act(async () => {
    chat.view.root.findByProps({ "aria-label": "Search this conversation" }).props.onChange({ target: { value: "launch" } });
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 280)));
  assert.equal(chat.requests.at(-1).q, "launch");
  await act(async () => chat.socket.fire("message:new", { id: "unrelated", conversationId: "chat", content: "Unrelated", createdAt: new Date().toISOString(), sender: user }));
  assert.deepEqual(chat.view.root.findAll((node) => node.props["data-message-id"]).map((node) => node.props["data-message-id"]), ["old"]);
});

test("chat history failures show a working retry and preserve the draft", async (t) => {
  let fail = true;
  const chat = await mountChat(t, true, [], { getPage: async () => { if (fail) throw new Error("History unavailable"); return { messages: [], nextCursor: null }; } });
  await chat.type("Don't lose this");
  assert.match(chat.view.root.findByProps({ role: "alert" }).children.map((node) => typeof node === "string" ? node : node.children?.join("")).join(""), /History unavailable/);
  fail = false;
  await act(async () => chat.view.root.findAllByType("button").find((node) => node.children.includes("Retry")).props.onClick());
  assert.equal(chat.view.root.findAllByProps({ role: "alert" }).length, 0);
  assert.equal(chat.input().props.value, "Don't lose this");
});

test("chat rejects an oversized message before emitting it", async (t) => {
  const chat = await mountChat(t);
  await chat.type("a".repeat(4001));
  await chat.submit();
  assert.equal(chat.socket.sent.filter((item) => item.event === "message:send").length, 0);
  assert.match(chat.view.root.findByProps({ role: "alert" }).children.join(""), /shorten/);
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

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";
import { build } from "esbuild";
import * as helpers from "../src/lib/chat.js";

async function bundle(path) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", external: ["react", "react/jsx-runtime"],
    plugins: [{ name: "mock-dependencies", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path, kind }) => kind === "entry-point" || ["react", "react/jsx-runtime"].includes(path) ? undefined : { path, namespace: "mock" });
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: `module.exports = globalThis.mocks[${JSON.stringify(path)}];`, loader: "js" }));
    } }],
  });
  return result.outputFiles[0].text;
}
const [globalCode, workspaceCode, dmCode] = await Promise.all([bundle("../src/pages/Chat.jsx"), bundle("../src/pages/WorkspaceChat.jsx"), bundle("../src/components/chat/NewDmModal.jsx")]);
const noop = () => null;
const icons = Object.fromEntries(["MessageSquare", "MessagesSquare", "PanelLeftClose", "PanelLeftOpen", "Plus", "Trash2", "Hash", "Circle", "Search", "Users"].map((name) => [name, noop]));
const thread = ({ conversation }) => React.createElement("article", { "data-conversation": conversation.id }, conversation.title);
const channel = (id, title = id) => ({ id, title, isGroup: true, isDefault: true, participants: [] });
const user = { id: "self", name: "Alex" };
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
function load(code, mocks) {
  const module = { exports: {} };
  vm.runInNewContext(code, { module, require: createRequire(import.meta.url), mocks, URLSearchParams, setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem() {} } });
  return module.exports.default;
}
async function mountPage(t, code, api, scope = { workspaceId: "first" }) {
  const component = load(code, {
    "react-router-dom": { useParams: () => scope, useLocation: () => ({ pathname: "/chat" }), useNavigate: () => noop },
    "lucide-react": icons,
    "../api/messages.js": api, "../api/conversations.js": api,
    "../api/workspaces.js": { getWorkspace: async () => ({ members: [] }) },
    "../api/client.js": { apiErrorMessage: (error) => error.message },
    "../context/AuthContext.jsx": { useAuth: () => ({ user }) },
    "../context/SocketContext.jsx": { useSocket: () => ({ socket: null }) },
    "../context/ConfirmContext.jsx": { useConfirm: () => noop },
    "../context/WorkspaceContext.jsx": { useWorkspaces: () => ({ workspaces: [] }) },
    "../components/common/Avatar.jsx": noop, "../components/common/EmptyState.jsx": noop,
    "../components/common/Spinner.jsx": () => React.createElement("span", { "data-spinner": true }),
    "../components/chat/ChatThread.jsx": thread, "../components/chat/NewDmModal.jsx": noop, "../components/chat/NewChannelModal.jsx": noop,
    "../components/chat/ConversationSearch.jsx": ({ value, onChange, label }) => React.createElement("input", { value, "aria-label": label || "Search conversations", onChange: (e) => onChange(e.target.value) }),
    "../lib/colors.js": { displayColor: () => "", textOn: () => "" }, "../lib/chat.js": helpers,
    "../hooks/useMediaQuery.js": Object.assign(() => true, { TWO_PANE: "" }), "../lib/access.js": { can: () => false },
  });
  let view;
  await act(async () => { view = create(React.createElement(component)); });
  t.after(() => act(() => view.unmount()));
  return { view, rerender: async () => act(async () => view.update(React.createElement(component))) };
}

for (const [name, code, method] of [["Messages", globalCode, "listConversations"], ["workspace channels", workspaceCode, "listWorkspaceConversations"]]) {
  test(`${name} load failures end the spinner and recover through Retry`, async (t) => {
    let fail = true;
    const { view } = await mountPage(t, code, { [method]: async () => { if (fail) throw new Error("Service unavailable"); return [channel("loaded")]; } });
    assert.equal(view.root.findAllByProps({ "data-spinner": true }).length, 0);
    assert.equal(view.root.findAllByProps({ role: "alert" }).length, 1);
    fail = false;
    await act(async () => view.root.findAllByType("button").find((button) => button.children.includes("Retry")).props.onClick());
    assert.equal(view.root.findAllByProps({ role: "alert" }).length, 0);
    assert.equal(view.root.findByType("article").props["data-conversation"], "loaded");
  });
}

test("changing workspace ignores the previous workspace's late channel response", async (t) => {
  const first = deferred();
  const scope = { workspaceId: "first" };
  const chat = await mountPage(t, workspaceCode, { listWorkspaceConversations: (id) => id === "first" ? first.promise : Promise.resolve([channel("second-channel")]) }, scope);
  scope.workspaceId = "second";
  await chat.rerender();
  await act(async () => first.resolve([channel("first-channel")]));
  assert.equal(chat.view.root.findByType("article").props["data-conversation"], "second-channel");
});

test("conversation navigation matches participant names and hides other conversation types", async (t) => {
  const conversations = [channel("team", "Design"), { id: "dm", title: "Riley Chen", isGroup: false, otherUser: { name: "Riley Chen" }, participants: [{ name: "Riley Chen" }] }];
  const { view } = await mountPage(t, globalCode, { listConversations: async () => conversations });
  await act(async () => view.root.findByProps({ "aria-label": "Search conversations" }).props.onChange({ target: { value: "Riley" } }));
  assert.equal(view.root.findAllByType("button").filter((button) => button.props["aria-current"] === "true").length, 0);
  assert.equal(view.root.findByType("article").props["data-conversation"], "team");
  await act(async () => view.root.findAllByType("button").find((button) => button.children.includes("Channels")).props.onClick());
  assert.equal(view.root.findAll((node) => node.type === "p" && node.children.includes("Riley Chen")).length, 0);
});

test("people search ignores an older response after a new query", async (t) => {
  const first = deferred(), second = deferred();
  const component = load(dmCode, {
    "lucide-react": icons, "../common/Modal.jsx": ({ children }) => React.createElement("div", null, children),
    "../common/Avatar.jsx": noop, "../common/WorkspaceMark.jsx": noop, "../common/Spinner.jsx": noop,
    "../../api/users.js": { listMyFollows: async () => ({ following: [] }), searchUsers: (q) => q === "Ri" ? first.promise : second.promise },
    "../../api/messages.js": {}, "../../api/workspaces.js": {}, "../../api/client.js": { apiErrorMessage: (error) => error.message },
    "../../context/AuthContext.jsx": { useAuth: () => ({ user }) }, "../../context/WorkspaceContext.jsx": { useWorkspaces: () => ({ workspaces: [] }) },
  });
  let view;
  await act(async () => { view = create(React.createElement(component, { open: true, onClose: noop, onStarted: noop })); });
  t.after(() => act(() => view.unmount()));
  await act(async () => view.root.findByType("input").props.onChange({ target: { value: "Ri" } }));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 280)));
  await act(async () => view.root.findByType("input").props.onChange({ target: { value: "Robin" } }));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 280)));
  await act(async () => second.resolve([{ id: "robin", name: "Robin" }]));
  await act(async () => first.resolve([{ id: "riley", name: "Riley" }]));
  assert.equal(view.root.findAllByType("p").filter((node) => node.children.includes("Robin")).length, 1);
  assert.equal(view.root.findAllByType("p").filter((node) => node.children.includes("Riley")).length, 0);
});

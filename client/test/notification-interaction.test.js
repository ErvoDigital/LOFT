import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";
import { build } from "esbuild";

async function bundle(path) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", external: ["react", "react/jsx-runtime"], plugins: [{ name: "mock-services", setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === "entry-point" || ["react", "react/jsx-runtime"].includes(path)) return;
      return { path, namespace: "mock" };
    });
    builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: `module.exports = globalThis.mocks[${JSON.stringify(path.split("/").at(-1))}];`, loader: "js" }));
  } }] });
  return result.outputFiles[0].text;
}
const providerCode = await bundle("../src/context/NotificationsContext.jsx");
const toastCode = await bundle("../src/components/notifications/NotificationToasts.jsx");
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function load(code, mocks, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(code, { module, mocks, require: createRequire(import.meta.url), ...globals });
  return module.exports;
}
function eventTarget() {
  const handlers = new Map();
  return { addEventListener(event, fn) { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event).add(fn); }, removeEventListener(event, fn) { handlers.get(event)?.delete(fn); }, fire(event) { for (const handler of handlers.get(event) || []) handler(); }, listeners: handlers };
}
const notification = (id, extra = {}) => ({ id, userId: "self", title: `Notice ${id}`, body: "Workspace activity", isRead: false, link: "/workspaces/team/tasks", createdAt: "2026-10-12T00:00:00Z", ...extra });

async function mount(t, options = {}) {
  const auth = { user: { id: "self" } }, browser = eventTarget(), document = { ...eventTarget(), visibilityState: "visible", hasFocus: () => focused };
  let focused = true, loads = 0, state, view;
  const handlers = new Map(), reads = [];
  const socket = { on(event, fn) { handlers.set(event, fn); }, off(event, fn) { if (handlers.get(event) === fn) handlers.delete(event); } };
  const exported = load(providerCode, { "AuthContext.jsx": { useAuth: () => auth }, "SocketContext.jsx": { useSocket: () => ({ socket }) }, "client.js": { apiErrorMessage: (error) => error.message }, "notifications.js": {
    listNotifications: () => { loads++; return options.list ? options.list(loads) : Promise.resolve({ notifications: [], unreadCount: 0 }); },
    markNotificationRead: (id) => { reads.push(id); return options.read ? options.read(id) : Promise.resolve(); },
    markAllNotificationsRead: options.readAll || (() => Promise.resolve()),
  } }, { window: browser, document });
  function Probe() { state = exported.useNotifications(); return null; }
  const tree = () => React.createElement(exported.NotificationsProvider, null, React.createElement(Probe));
  await act(async () => { view = create(tree()); });
  t.after(() => act(() => view.unmount()));
  const fire = async (event, data) => act(async () => handlers.get(event)?.(data));
  const activity = async ({ visible = document.visibilityState === "visible", focus = focused } = {}) => act(async () => {
    focused = focus; document.visibilityState = visible ? "visible" : "hidden";
    document.fire("visibilitychange"); browser.fire(focus ? "focus" : "blur");
  });
  return { get state() { return state; }, get loads() { return loads; }, reads, fire, activity, view, setUser: async (user) => { auth.user = user; await act(async () => view.update(tree())); } };
}

test("active notifications appear once and limit the popup stack to the latest three", async (t) => {
  const app = await mount(t);
  for (const id of ["a", "b", "c", "d"]) await app.fire("notification:new", notification(id));
  await app.fire("notification:new", notification("d"));
  assert.deepEqual(Array.from(app.state.toasts, (item) => item.id), ["b", "c", "d"]);
  assert.equal(app.state.notifications.length, 4); assert.equal(app.state.unreadCount, 4);
  await act(async () => app.state.dismissToast("d"));
  assert.equal(app.state.toasts.length, 2); assert.equal(app.state.unreadCount, 4);
});

test("hidden and unfocused tabs keep notifications in the bell without popups", async (t) => {
  const app = await mount(t);
  await app.fire("notification:new", notification("a"));
  await app.activity({ visible: false, focus: false }); assert.equal(app.state.toasts.length, 0);
  await app.fire("notification:new", notification("b")); assert.equal(app.state.unreadCount, 2); assert.equal(app.state.toasts.length, 0);
  await app.activity({ visible: true, focus: false });
  await app.fire("notification:new", notification("c")); assert.equal(app.state.toasts.length, 0);
});

test("history and reconnection refreshes do not replay old notifications as popups", async (t) => {
  const app = await mount(t, { list: async () => ({ notifications: [notification("old")], unreadCount: 12 }) });
  assert.equal(app.state.unreadCount, 12); assert.equal(app.state.toasts.length, 0);
  await app.fire("connect"); assert.equal(app.state.toasts.length, 0);
  await app.fire("notification:new", notification("old")); assert.equal(app.state.unreadCount, 12);
  await app.activity(); assert.equal(app.state.toasts.length, 0);
});

test("notifications arriving during a load cannot be overwritten by its stale response", async (t) => {
  const pending = deferred();
  const app = await mount(t, { list: (count) => count === 1 ? pending.promise : Promise.resolve({ notifications: [notification("live"), notification("old")], unreadCount: 2 }) });
  await app.fire("notification:new", notification("live"));
  await act(async () => pending.resolve({ notifications: [notification("old")], unreadCount: 1 }));
  assert.equal(app.state.notifications.length, 2); assert.equal(app.state.unreadCount, 2);
  assert.deepEqual(Array.from(app.state.toasts, (item) => item.id), ["live"]); assert.equal(app.loads, 2);
});

test("logout clears popups and ignores pending requests and other account notifications", async (t) => {
  const pending = deferred(); const app = await mount(t, { list: () => pending.promise });
  await app.fire("notification:new", notification("a"));
  await app.fire("notification:new", notification("foreign", { userId: "someone" }));
  assert.equal(app.state.toasts.length, 1);
  await app.setUser(null);
  await act(async () => pending.resolve({ notifications: [notification("late")], unreadCount: 1 }));
  assert.equal(app.state.notifications.length, 0); assert.equal(app.state.toasts.length, 0);
});

test("opening the same unread notification twice sends one read request and decrements once", async (t) => {
  const pending = deferred(); const app = await mount(t, { read: () => pending.promise });
  await app.fire("notification:new", notification("a"));
  let first, second;
  await act(async () => { first = app.state.markRead("a"); second = app.state.markRead("a"); });
  assert.equal(app.reads.length, 1); assert.equal(app.state.unreadCount, 1);
  await act(async () => { pending.resolve(); await Promise.all([first, second]); });
  assert.equal(app.state.unreadCount, 0); assert.equal(app.state.toasts.length, 0);
  await act(async () => app.state.markRead("a")); assert.equal(app.reads.length, 1);
});

test("failed reads preserve unread state and notification load failures support retry", async (t) => {
  let fail = true;
  const app = await mount(t, { list: async () => { if (fail) throw Error("Unavailable"); return { notifications: [notification("a")], unreadCount: 1 }; }, read: async () => { throw Error("Read failed"); } });
  assert.equal(app.state.error, "Unavailable");
  fail = false; await act(async () => app.state.refresh()); assert.equal(app.state.error, "");
  await act(async () => app.state.markRead("a")); assert.equal(app.state.unreadCount, 1); assert.equal(app.state.error, "Read failed");
});

function fakeClock() {
  let now = 0, sequence = 0;
  const jobs = new Map();
  return { Date: class extends Date { static now() { return now; } }, setTimeout(fn, delay) { const id = ++sequence; jobs.set(id, { at: now + delay, fn }); return id; }, clearTimeout(id) { jobs.delete(id); }, async advance(ms) {
    const end = now + ms;
    while (true) { const next = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; now = next[1].at; jobs.delete(next[0]); await act(async () => next[1].fn()); }
    now = end;
  } };
}
async function mountToast(t) {
  const clock = fakeClock(), dismissed = [], reads = [], destinations = [], noop = () => null;
  const exported = load(toastCode, { "NotificationsContext.jsx": { useNotifications: () => ({ markRead: (id) => reads.push(id) }) }, "react-router-dom": { useNavigate: () => (path) => destinations.push(path), useLocation: () => ({ pathname: "/" }) }, "lucide-react": Object.fromEntries(["AtSign", "Bell", "CalendarDays", "CheckSquare", "Users", "Video", "X"].map((name) => [name, noop])) }, clock);
  let view; const onDismiss = (id) => dismissed.push(id);
  await act(async () => { view = create(React.createElement(exported.NotificationToast, { toast: notification("a"), onDismiss })); });
  t.after(() => act(() => view.unmount()));
  return { view, clock, dismissed, reads, destinations, article: () => view.root.findByType("article") };
}

test("popups expire after eight seconds and hover preserves the remaining reading time", async (t) => {
  const toast = await mountToast(t);
  await toast.clock.advance(3000); await act(async () => toast.article().props.onMouseEnter());
  await toast.clock.advance(20000); assert.equal(toast.dismissed.length, 0);
  await act(async () => toast.article().props.onMouseLeave()); await toast.clock.advance(4999); assert.equal(toast.dismissed.length, 0);
  await toast.clock.advance(1); assert.deepEqual(toast.dismissed, ["a"]);
});

test("keyboard focus pauses popups and moving between their buttons keeps them paused", async (t) => {
  const toast = await mountToast(t);
  await act(async () => toast.article().props.onFocusCapture()); await toast.clock.advance(15000);
  await act(async () => toast.article().props.onBlurCapture({ currentTarget: { contains: () => true }, relatedTarget: {} }));
  await toast.clock.advance(15000); assert.equal(toast.dismissed.length, 0);
  await act(async () => toast.article().props.onBlurCapture({ currentTarget: { contains: () => false }, relatedTarget: null }));
  await toast.clock.advance(8000); assert.equal(toast.dismissed.length, 1);
});

test("dismiss leaves a notification unread while opening it marks read and navigates", async (t) => {
  const toast = await mountToast(t);
  await act(async () => toast.view.root.findByProps({ "aria-label": "Dismiss notification: Notice a" }).props.onClick());
  assert.deepEqual(toast.dismissed, ["a"]); assert.equal(toast.reads.length, 0);
  await act(async () => toast.view.root.findByProps({ "aria-label": "Open notification: Notice a" }).props.onClick());
  assert.deepEqual(toast.reads, ["a"]); assert.deepEqual(toast.destinations, ["/workspaces/team/tasks"]);
});

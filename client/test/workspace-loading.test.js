import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";
import { build } from "esbuild";

const bundled = await build({
  stdin: {
    contents: `export { WorkspaceProvider, useWorkspaces } from './context/WorkspaceContext.jsx';
      export { default as Dashboard } from './pages/Dashboard.jsx';`,
    resolveDir: fileURLToPath(new URL("../src/", import.meta.url)),
  },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  external: ["react", "react/jsx-runtime"],
  plugins: [{ name: "workspace-boundaries", setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path }) => {
      let mock;
      if (path.endsWith("/api/workspaces.js")) mock = "workspaces-api";
      else if (path.endsWith("/api/dashboard.js")) mock = "dashboard-api";
      else if (path.endsWith("/api/client.js")) mock = "api-client";
      else if (path.endsWith("/AuthContext.jsx")) mock = "auth";
      else if (path.endsWith("/SocketContext.jsx")) mock = "socket";
      else if (["react-router-dom", "lucide-react"].includes(path)) mock = path;
      else if (path.includes("components/") && path.endsWith(".jsx") && !path.endsWith("/WorkspaceList.jsx")) {
        mock = path.split("/").at(-1);
      }
      if (mock) return { path: mock, namespace: "mock" };
    });
    builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({
      contents: `module.exports = globalThis.mocks[${JSON.stringify(path)}];`, loader: "js",
    }));
  } }],
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const workspace = { id: "ws-existing", name: "Existing team", type: "work", memberCount: 2 };
const dashboardData = { workspaces: [workspace], upcomingEvents: [], pendingTasks: [], conflicts: [] };

async function mount(t, { list = async () => [workspace], dashboard = async () => dashboardData, showDashboard = true } = {}) {
  let user = { id: "u-existing", name: "Ada Admin" };
  let state;
  const noop = () => null;
  const components = Object.fromEntries([
    "ConflictsPanel", "FortnightSkyline", "AgendaPanel", "MetricStrip", "PendingTasksPanel",
    "ActivityFeed", "RecentFilesPanel", "WorkspaceModal", "WorkspaceMark",
  ].map((name) => [`${name}.jsx`, noop]));
  const module = { exports: {} };
  vm.runInNewContext(bundled.outputFiles[0].text, {
    module, require: createRequire(import.meta.url),
    mocks: {
      "workspaces-api": { listWorkspaces: () => list() },
      "dashboard-api": { getDashboard: () => dashboard() },
      "api-client": { apiErrorMessage: (err) => err.message },
      auth: { useAuth: () => ({ user }) },
      socket: { useSocket: () => ({ socket: null }) },
      "react-router-dom": { Link: ({ to, children }) => React.createElement("a", { href: to }, children), useNavigate: () => noop },
      "lucide-react": Object.fromEntries(["AlarmClock", "CalendarClock", "ListChecks", "Plus", "ShieldCheck", "Video"].map((name) => [name, noop])),
      ...components,
      "Spinner.jsx": () => React.createElement("div", { role: "status" }, "Loading"),
      "CustomizableDashboard.jsx": ({ render }) => React.createElement("div", { "data-dashboard": true }, render("workspaces")),
    },
  });
  const { WorkspaceProvider, useWorkspaces, Dashboard } = module.exports;
  function Probe() { state = useWorkspaces(); return null; }
  const tree = () => React.createElement(WorkspaceProvider, null,
    React.createElement(Probe), showDashboard ? React.createElement(Dashboard) : null);
  let view;
  await act(async () => { view = create(tree()); });
  t.after(() => act(() => view.unmount()));
  return {
    view, get state() { return state; },
    setUser: async (next) => { user = next; await act(async () => view.update(tree())); },
  };
}

const textOf = (view) => JSON.stringify(view.toJSON());
const retry = (app) => app.view.root.findAllByType("button").find((node) => node.children.includes("Try again"));

test("waits for existing workspaces even when dashboard data arrives first", async (t) => {
  const request = deferred();
  const app = await mount(t, { list: () => request.promise });
  assert.equal(app.state.loading, true);
  assert.ok(app.view.root.findByProps({ role: "status" }));
  assert.doesNotMatch(textOf(app.view), /Add your first workspace/);
  await act(async () => request.resolve([workspace]));
  assert.match(textOf(app.view), /Existing team/);
  assert.ok(app.view.root.findByProps({ href: "/workspaces/ws-existing/dashboard" }));
});

test("a failed workspace request shows an error and can recover through retry", async (t) => {
  let attempts = 0;
  const app = await mount(t, { list: async () => {
    if (++attempts === 1) throw new Error("Workspace service unavailable");
    return [workspace];
  } });
  assert.equal(app.state.loading, false);
  assert.equal(app.state.error, "Workspace service unavailable");
  assert.match(textOf(app.view), /Couldn't load your workspaces/);
  assert.doesNotMatch(textOf(app.view), /Add your first workspace/);
  await act(async () => retry(app).props.onClick());
  assert.equal(app.state.error, null);
  assert.match(textOf(app.view), /Existing team/);
});

test("only a successful empty workspace response shows onboarding", async (t) => {
  const app = await mount(t, { list: async () => [] });
  assert.equal(app.state.error, null);
  assert.match(textOf(app.view), /Add your first workspace/);
});

test("a failed dashboard leaves existing workspace navigation available and supports retry", async (t) => {
  let attempts = 0;
  const app = await mount(t, { dashboard: async () => {
    if (++attempts === 1) throw new Error("Dashboard service unavailable");
    return dashboardData;
  } });
  assert.match(textOf(app.view), /Couldn't load your dashboard/);
  assert.ok(app.view.root.findByProps({ href: "/workspaces/ws-existing/dashboard" }));
  await act(async () => retry(app).props.onClick());
  assert.equal(app.view.root.findAllByProps({ role: "alert" }).length, 0);
  assert.ok(app.view.root.findByProps({ "data-dashboard": true }));
});

test("a refresh failure preserves previously loaded workspaces", async (t) => {
  let attempts = 0;
  const app = await mount(t, { list: async () => {
    if (++attempts > 1) throw new Error("Connection interrupted");
    return [workspace];
  } });
  await act(async () => { await assert.rejects(app.state.refresh(), /Connection interrupted/); });
  assert.equal(app.state.workspaces[0].id, workspace.id);
  assert.match(textOf(app.view), /Couldn't refresh your workspaces/);
  assert.match(textOf(app.view), /Existing team/);
});

test("logout discards a pending response instead of restoring the previous account's workspaces", async (t) => {
  const request = deferred();
  const app = await mount(t, { list: () => request.promise, showDashboard: false });
  await app.setUser(null);
  await act(async () => request.resolve([workspace]));
  assert.equal(app.state.workspaces.length, 0);
  assert.equal(app.state.loading, false);
});

test("an older account's response cannot replace the current account's workspaces", async (t) => {
  const first = deferred();
  const second = deferred();
  let attempts = 0;
  const app = await mount(t, { list: () => ++attempts === 1 ? first.promise : second.promise, showDashboard: false });
  await app.setUser({ id: "u-other", name: "Other User" });
  await act(async () => second.resolve([{ ...workspace, id: "ws-other", name: "Other team" }]));
  await act(async () => first.resolve([workspace]));
  assert.equal(app.state.workspaces[0].id, "ws-other");
});

test("an older refresh cannot overwrite a newer result", async (t) => {
  const first = deferred();
  const second = deferred();
  let attempts = 0;
  const app = await mount(t, { list: () => ++attempts === 1 ? first.promise : second.promise, showDashboard: false });
  let refresh;
  await act(async () => { refresh = app.state.refresh(); });
  await act(async () => { second.resolve([{ ...workspace, name: "Updated team" }]); await refresh; });
  await act(async () => first.resolve([workspace]));
  assert.equal(app.state.workspaces[0].name, "Updated team");
});

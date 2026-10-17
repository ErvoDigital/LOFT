import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";
import { build } from "esbuild";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../src/pages/WorkspaceTasks.jsx", import.meta.url))], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", external: ["react", "react/jsx-runtime"],
  plugins: [{ name: "mock-services", setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === "entry-point" || ["react", "react/jsx-runtime"].includes(path)) return;
      if (["lucide-react", "react-router-dom"].includes(path) || /\/api\//.test(path) || /\/context\//.test(path) || /\/(Select|Spinner|Avatar|EmptyState|TaskModal|TaskDetailsPanel|TaskStatusManagerModal)\.jsx$/.test(path)) return { path, namespace: "mock" };
    });
    builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: `module.exports = globalThis.mocks[${JSON.stringify(path.split("/").at(-1))}];`, loader: "js" }));
  } }],
});
const code = result.outputFiles[0].text;
const noop = () => null;
const icons = Object.fromEntries(["SlidersHorizontal", "Pin", "Moon", "Columns3", "List", "Table2", "CalendarDays", "Search", "X", "Filter", "ChevronDown", "ChevronRight", "ChevronLeft", "Clock3", "Pencil", "ArrowUp", "ArrowDown", "ArrowUpDown", "AlertTriangle", "CircleDot", "Archive", "Building2", "FolderOpen", "ListChecks", "Users"].map((name) => [name, noop]));
const statuses = [{ id: "todo", label: "To do" }, { id: "review", label: "Review" }, { id: "done", label: "Done", isDone: true }];
const fixtureTasks = [
  { id: "a", title: "Release notes", status: "todo", tier: "TIER_2", order: 1, estimatedMinutes: 30, dueDate: "2026-10-12T00:00:00.000Z", assignee: { id: "self", name: "Alex" } },
  { id: "b", title: "Design review", status: "review", tier: "TIER_1", order: 2, estimatedMinutes: 60, dueDate: null, assignee: { id: "other", name: "Riley" } },
];
const defer = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
async function mount(t, options = {}) {
  const scope = options.scope || { workspaceId: "workspace" };
  let tasks = fixtureTasks.map((task) => ({ ...task }));
  const writes = [], storage = options.storage || new Map(), handlers = new Map();
  const socket = { on(event, fn) { handlers.set(event, fn); }, off(event, fn) { if (handlers.get(event) === fn) handlers.delete(event); } };
  const api = {
    listWorkspaceTasks: options.list || (async () => tasks),
    updateTask: async (workspace, id, data) => {
      writes.push({ workspace, id, data });
      if (options.update) return options.update(workspace, id, data);
      const saved = { ...tasks.find((task) => task.id === id), ...data };
      tasks = tasks.map((task) => task.id === id ? saved : task);
      return saved;
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, require: createRequire(import.meta.url), mocks: {
    "lucide-react": icons, "react-router-dom": { useParams: () => scope, useLocation: () => ({ search: options.search || "" }) },
    "tasks.js": api, "workspaces.js": { getWorkspace: async () => ({ myRole: options.role || "ADMIN", members: [] }) }, "taskStatuses.js": { listTaskStatuses: async () => statuses },
    "client.js": { apiErrorMessage: (error) => error.message }, "SocketContext.jsx": { useSocket: () => ({ socket }) }, "AuthContext.jsx": { useAuth: () => ({ user: { id: "self" } }) },
    "Select.jsx": ({ options, onChange, ...props }) => React.createElement("select", { ...props, onChange: (event) => onChange(event.target.value) }, options.map((option) => React.createElement("option", { value: option.value, key: option.value }, option.label))),
    "Avatar.jsx": noop, "Spinner.jsx": () => React.createElement("span", { "data-spinner": true }), "EmptyState.jsx": ({ title }) => React.createElement("p", null, title),
    "TaskModal.jsx": ({ open, task, onSaved }) => open ? React.createElement("section", { "data-editor": true, "data-edit-id": task?.id, onSaved }) : null,
    "TaskDetailsPanel.jsx": ({ open, task }) => open && task ? React.createElement("section", { "data-details-id": task.id }, task.title) : null,
    "TaskStatusManagerModal.jsx": noop,
  }, URLSearchParams, setInterval, clearInterval, localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) } });
  const component = module.exports.default;
  let view;
  await act(async () => { view = create(React.createElement(component)); });
  t.after(() => act(() => view.unmount()));
  const choose = async (label) => act(async () => view.root.findAllByType("button").find((button) => button.children.includes(label) || button.findAllByType("span").some((span) => span.children.includes(label))).props.onClick());
  const findSelect = (label) => view.root.findAllByType("select").find((node) => node.props["aria-label"] === label);
  const select = async (label, value) => act(async () => findSelect(label).props.onChange({ target: { value } }));
  const rows = () => view.root.findAll((node) => node.props["data-task-id"]).map((node) => node.props["data-task-id"]);
  return { view, storage, writes, rows, choose, select, findSelect, scope, fire: async (event, data) => act(async () => handlers.get(event)?.(data)), rerender: async () => act(async () => view.update(React.createElement(component))) };
}

test("switching task views preserves task identity, filters, details and edit actions", async (t) => {
  const page = await mount(t);
  assert.deepEqual(page.rows(), ["a", "b"]);
  await page.choose("List");
  assert.deepEqual(page.rows(), ["a", "b"]);
  await page.choose("Release notes");
  assert.equal(page.view.root.findByProps({ "data-details-id": "a" }).children[0], "Release notes");
  await page.choose("Table");
  await page.select("Filter by assignee", "mine");
  assert.deepEqual(page.rows(), ["a"]);
  await act(async () => page.view.root.findByProps({ "aria-label": "Edit Release notes" }).props.onClick());
  assert.equal(page.view.root.findByProps({ "data-editor": true }).props["data-edit-id"], "a");
  await page.choose("Board");
  assert.deepEqual(page.rows(), ["a"]);
});

test("table status changes use the existing task API and remain visible in the board", async (t) => {
  const page = await mount(t);
  await page.choose("Table");
  await page.select("Status of Release notes", "done");
  assert.deepEqual(page.writes.map((write) => ({ ...write, data: { ...write.data } })), [{ workspace: "workspace", id: "a", data: { status: "done", order: 1 } }]);
  await page.choose("Board");
  assert.deepEqual(page.rows(), ["b", "a"]);
});

test("members can update only their own task statuses in list and table", async (t) => {
  const page = await mount(t, { role: "MEMBER" });
  for (const view of ["List", "Table"]) {
    await page.choose(view);
    assert.equal(page.view.root.findByProps({ "aria-label": "Status of Release notes" }).props.disabled, false);
    assert.equal(page.view.root.findByProps({ "aria-label": "Status of Design review" }).props.disabled, true);
    await page.select("Status of Design review", "done");
  }
  assert.equal(page.writes.length, 0);
});

test("a pending status save blocks duplicate writes and failures retain the prior status", async (t) => {
  const pending = defer();
  const page = await mount(t, { update: () => pending.promise });
  await page.choose("Table");
  await act(async () => { page.findSelect("Status of Release notes").props.onChange({ target: { value: "done" } }); });
  assert.equal(page.view.root.findByProps({ "aria-label": "Status of Release notes" }).props.disabled, true);
  await act(async () => { page.findSelect("Status of Release notes").props.onChange({ target: { value: "review" } }); });
  assert.equal(page.writes.length, 1);
  await act(async () => pending.reject(new Error("Update failed")));
  assert.equal(page.view.root.findByProps({ "aria-label": "Status of Release notes" }).props.value, "todo");
  assert.equal(page.view.root.findAllByProps({ role: "alert" }).length, 1);
});

test("view preferences are saved per user and workspace and restored after reopening", async (t) => {
  const storage = new Map([["loft:task-view:self:other", "list"]]);
  const page = await mount(t, { storage });
  await page.choose("Table");
  assert.equal(storage.get("loft:task-view:self:workspace"), "table");
  await act(async () => page.view.unmount());
  const reopened = await mount(t, { storage });
  assert.equal(reopened.view.root.findAllByType("button").find((button) => button.children.includes("Table")).props["aria-pressed"], true);
  reopened.scope.workspaceId = "other";
  await reopened.rerender();
  assert.equal(reopened.view.root.findAllByType("button").find((button) => button.children.includes("List")).props["aria-pressed"], true);
  assert.equal(storage.get("loft:task-view:self:workspace"), "table");
});

test("failed task loads stop the spinner and can recover through Retry", async (t) => {
  let fail = true;
  const page = await mount(t, { list: async () => { if (fail) throw new Error("Unavailable"); return fixtureTasks; } });
  assert.equal(page.view.root.findAllByProps({ "data-spinner": true }).length, 0);
  assert.equal(page.view.root.findAllByProps({ role: "alert" }).length, 1);
  fail = false;
  await page.choose("Retry");
  assert.deepEqual(page.rows(), ["a", "b"]);
});

test("table column sorting is shared with list view and optional columns can be hidden", async (t) => {
  const page = await mount(t);
  await page.choose("Table");
  await act(async () => page.view.root.findByProps({ "aria-label": "Sort by task" }).props.onClick());
  assert.deepEqual(page.rows(), ["b", "a"]);
  const headers = () => page.view.root.findAllByType("th").length;
  const before = headers();
  await act(async () => page.view.root.findAllByType("input").find((node) => node.props.type === "checkbox").props.onChange({ target: { checked: false } }));
  assert.equal(headers(), before - 1);
  await page.choose("List");
  await page.select("Group tasks by", "none");
  assert.deepEqual(page.rows(), ["b", "a"]);
});

test("calendar provides access to tasks without due dates", async (t) => {
  const page = await mount(t);
  await page.choose("Calendar");
  const undated = page.view.root.findAllByType("button").find((button) => button.children.join("") === "No due date (1)");
  await act(async () => undated.props.onClick());
  assert.deepEqual(page.rows(), ["b"]);
  await page.choose("Design review");
  assert.ok(page.view.root.findByProps({ "data-details-id": "b" }));
});

test("late task loads cannot replace the new workspace's tasks", async (t) => {
  const first = defer();
  const page = await mount(t, { list: (workspace) => workspace === "workspace" ? first.promise : Promise.resolve([{ ...fixtureTasks[0], id: "second" }]) });
  page.scope.workspaceId = "second-workspace";
  await page.rerender();
  await act(async () => first.resolve(fixtureTasks));
  assert.deepEqual(page.rows(), ["second"]);
});

test("returning to a workspace ignores a response from its previous visit", async (t) => {
  const pending = defer();
  let returned = false;
  const page = await mount(t, { list: async (workspace) => workspace === "workspace"
    ? [{ ...fixtureTasks[0], ...(returned ? { title: "Newer task", status: "review" } : {}) }]
    : [{ ...fixtureTasks[0], id: "second" }], update: () => pending.promise });
  await page.choose("Table");
  await act(async () => { page.findSelect("Status of Release notes").props.onChange({ target: { value: "done" } }); });
  page.scope.workspaceId = "second-workspace";
  await page.rerender();
  returned = true;
  page.scope.workspaceId = "workspace";
  await page.rerender();
  await act(async () => pending.resolve({ ...fixtureTasks[0], status: "done" }));
  assert.equal(page.findSelect("Status of Newer task").props.value, "review");
});

test("realtime updates received during a status save are loaded when the save finishes", async (t) => {
  const pending = defer();
  let latest = fixtureTasks;
  const page = await mount(t, { list: async () => latest, update: () => pending.promise });
  await page.choose("Table");
  await act(async () => { page.findSelect("Status of Release notes").props.onChange({ target: { value: "done" } }); });
  latest = [{ ...fixtureTasks[0], status: "done" }, fixtureTasks[1], { ...fixtureTasks[1], id: "incoming", title: "New task" }];
  await page.fire("task:created", { workspaceId: "workspace", id: "incoming" });
  assert.equal(page.rows().includes("incoming"), false);
  await act(async () => pending.resolve({ ...fixtureTasks[0], status: "done" }));
  assert.deepEqual(new Set(page.rows()), new Set(["a", "b", "incoming"]));
});

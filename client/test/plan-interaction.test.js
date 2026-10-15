import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";
import { build } from "esbuild";

const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/pages/MyPlan.jsx", import.meta.url))], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", external: ["react", "react/jsx-runtime"], plugins: [{ name: "plan-dependencies", setup(builder) {
  builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
    if (kind === "entry-point" || ["react", "react/jsx-runtime"].includes(path)) return;
    if (["lucide-react", "react-router-dom"].includes(path) || /\/api\//.test(path) || /\/context\//.test(path) || /\/(Select|Spinner|EmptyState|TaskModal|TaskDetailsPanel|PlanCalendar|ConflictsPanel|PlanFocusHero|AtRiskPanel)\.jsx$/.test(path)) return { path, namespace: "mock" };
  });
  builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: `module.exports=globalThis.mocks[${JSON.stringify(path.split("/").at(-1))}];`, loader: "js" }));
} }] });
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const noop = () => null;
const today = new Date();
const due = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18).toISOString();
const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 18).toISOString();
const key = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fixture = [
  { id: "a", title: "Fix release", workspaceId: "workspace", workspaceName: "Launch", tier: "TIER_1", score: 1000, status: "todo", estimatedMinutes: 60, dueDate: due },
  { id: "b", title: "Prepare notes", workspaceId: "workspace", workspaceName: "Launch", tier: "TIER_3", score: 200, status: "todo", estimatedMinutes: 30, dueDate: due },
  { id: "c", title: "Tomorrow task", workspaceId: "workspace", workspaceName: "Launch", tier: "TIER_2", score: 500, status: "todo", estimatedMinutes: 30, dueDate: tomorrow },
];

async function mount(t, options = {}) {
  const account = { id: "alice", aiPriorityEnabled: options.aiEnabled !== false };
  const timers = new Map(); let timerId = 0;
  const storage = options.storage || new Map();
  const events = new Map(), writes = [], recommendations = [], loads = [];
  let tasks = fixture.map((task) => ({ ...task }));
  const planApi = {
    getPlan: async (capacity) => { loads.push(capacity); if (options.loadError) throw options.loadError; return { tasks, conflicts: [], events: [], statusesByWorkspace: { workspace: [{ id: "todo", label: "To do" }, { id: "done", label: "Done", isDone: true }] } }; },
    getRecommendations: async (data, signal) => { recommendations.push({ data, signal }); if (options.recommendation) return options.recommendation.promise; if (options.recommendationError) throw options.recommendationError; return { order: [...new Set([...(data.manual?.order || []), ...(options.order || ["a", "b", "c"])])], summary: "Work in your chosen order.", items: [{ taskId: "a", title: "Fix release", workspaceName: "Launch", reason: "Urgent priority and due today.", nextStep: "Review the requirements and begin." }] }; },
  };
  const exported = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, { module: exported, require: createRequire(import.meta.url), AbortController,
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; }, clearTimeout: (id) => timers.delete(id),
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => { if (options.blockStorage) throw Error("storage blocked"); storage.set(key, value); } },
    mocks: {
      "lucide-react": Object.fromEntries(["CalendarCheck", "CalendarDays", "CalendarRange", "Rows3", "Sparkles", "ArrowUp", "ArrowDown", "Pencil", "AlertTriangle", "Clock3", "CircleDot", "Archive", "AlarmClock", "Infinity", "Pin", "Moon", "ChevronLeft", "ChevronRight"].map((name) => [name, noop])),
      "react-router-dom": { useNavigate: () => noop },
      "AuthContext.jsx": { useAuth: () => ({ user: account }) },
      "SocketContext.jsx": { useSocket: () => ({ socket: { on: (name, callback) => events.set(name, callback), off: (name) => events.delete(name) } }) },
      "plan.js": planApi,
      "tasks.js": { updateTask: async (workspaceId, taskId, patch) => { writes.push({ workspaceId, taskId, patch }); if (options.updateError) throw options.updateError; tasks = tasks.map((task) => task.id === taskId ? { ...task, ...patch } : task); }, listWorkspaceTasks: async () => tasks.map((task) => ({ ...task, description: "Full task details" })) },
      "workspaces.js": { getWorkspace: async () => ({ members: [] }) },
      "taskStatuses.js": { listTaskStatuses: async () => [{ id: "todo", label: "To do" }] },
      "client.js": { apiErrorMessage: (error) => error.message },
      "Select.jsx": ({ options, onChange, ...props }) => React.createElement("select", { ...props, onChange: ({ target }) => onChange(target.value) }, options.map(({ value, label }) => React.createElement("option", { key: value, value }, label))),
      "Spinner.jsx": noop, "EmptyState.jsx": ({ title }) => React.createElement("p", null, title), "ConflictsPanel.jsx": noop, "AtRiskPanel.jsx": noop,
      "PlanFocusHero.jsx": ({ focus }) => React.createElement("div", { "data-focus": focus?.item.taskId }),
      "PlanCalendar.jsx": ({ tasks }) => React.createElement("div", { "data-calendar-tasks": tasks }),
      "TaskDetailsPanel.jsx": ({ open, task, onEdit }) => open ? React.createElement("div", { "data-details": task.id }, React.createElement("button", { onClick: onEdit }, "Edit task")) : null,
      "TaskModal.jsx": ({ open, task, onSaved }) => open ? React.createElement("div", { "data-task-editor": task.id, "data-description": task.description, onSaved }) : null,
    },
  });
  let view;
  await act(async () => { view = create(React.createElement(exported.exports.default)); });
  t.after(() => act(() => view.unmount()));
  const click = async (label) => act(async () => view.root.findAllByType("button").find((button) => button.props["aria-label"] === label || button.children.includes(label)).props.onClick());
  const rows = () => view.root.findAll((node) => typeof node.type === "string" && node.props["data-task-id"]).map((node) => node.props["data-task-id"]);
  return { view, storage, account, writes, recommendations, loads, click, rows, events, timers,
    analyze: async () => act(async () => { const pending = [...timers].filter(([, timer]) => timer.delay === 700); for (const [id, timer] of pending) { timers.delete(id); void timer.callback(); } }),
    rerender: async () => act(async () => view.update(React.createElement(exported.exports.default))) };
}


test("AI analysis is automatic by default, updates the plan order and has no separate order mode", async (t) => {
  const page = await mount(t, { order: ["b", "a", "c"] });
  assert.equal(page.recommendations.length, 0, "Changes are debounced before a paid request");
  await page.analyze();
  assert.equal(page.recommendations.length, 1);
  assert.deepEqual(page.rows(), ["b", "a", "c"]);
  assert.equal(page.view.root.findByProps({ "data-focus": "b" }).props["data-focus"], "b");
  assert.doesNotMatch(JSON.stringify(page.view.toJSON()), /My order|Get recommendations|Edit my plan/);
  assert.match(JSON.stringify(page.view.toJSON()), /Why now|Next step/);
  assert.equal(page.writes.length, 0);
});

test("Tasks can be reordered and edited directly and personal choices survive refreshes and views", async (t) => {
  const page = await mount(t);
  await page.analyze();
  await page.click("Move Fix release down");
  assert.deepEqual(page.rows(), ["b", "a", "c"]);
  const day = key(new Date(tomorrow));
  await act(async () => page.view.root.findByProps({ "aria-label": "Planned day for Prepare notes" }).props.onChange({ target: { value: day } }));
  await page.click("Week");
  assert.equal(page.rows()[0], "b");
  await page.click("Calendar");
  const planned = page.view.root.findAll((node) => typeof node.type === "string" && node.props["data-calendar-tasks"])[0].props["data-calendar-tasks"].find((task) => task.id === "b");
  assert.equal(planned.plannedDate, day); assert.equal(planned.dueDate, due);
  await act(async () => page.events.get("task:updated")());
  assert.equal(JSON.parse(page.storage.get("loft:my-plan:alice")).dates.b, day);
  assert.equal(page.writes.length, 0);
  await page.click("Day by day");
  await page.click("Edit task Prepare notes");
  assert.equal(page.view.root.findByProps({ "data-task-editor": "b" }).props["data-description"], "Full task details");
  await page.click("Reset personal changes");
  assert.deepEqual(page.rows(), ["a", "b", "c"]);
});

test("Disabled personal setting prevents automatic analysis but leaves manual ordering and editing available", async (t) => {
  const page = await mount(t, { aiEnabled: false, order: ["b", "a", "c"] });
  await page.analyze();
  assert.equal(page.recommendations.length, 0);
  assert.equal(page.view.root.findAllByProps({ "aria-label": "Lofty priority analysis" }).length, 0);
  await page.click("Move Fix release down");
  assert.deepEqual(page.rows(), ["b", "a", "c"]);
  await page.click("Edit task Prepare notes");
  assert.equal(page.view.root.findByProps({ "data-task-editor": "b" }).props["data-description"], "Full task details");
  page.account.aiPriorityEnabled = true; await page.rerender(); await page.analyze();
  assert.equal(page.recommendations.length, 1);
  assert.deepEqual(page.rows(), ["b", "a", "c"], "AI respects the manual move");
});

test("Meaningful edits cancel pending analysis and stale answers cannot overwrite manual changes", async (t) => {
  const recommendation = defer(); const options = { recommendation };
  const page = await mount(t, options); await page.analyze();
  await page.click("Move Fix release down");
  assert.equal(page.recommendations[0].signal.aborted, true);
  await act(async () => recommendation.resolve({ summary: "Old answer", order: ["a", "b", "c"], items: [] }));
  assert.doesNotMatch(JSON.stringify(page.view.toJSON()), /Old answer/);
  assert.deepEqual(page.rows(), ["b", "a", "c"]);
  options.recommendation = null; options.recommendationError = new Error("Provider unavailable");
  await page.analyze();
  assert.match(JSON.stringify(page.view.toJSON()), /couldn't analyze your priorities/);
  await page.click("Move Prepare notes down");
  assert.deepEqual(page.rows(), ["a", "b", "c"]);
});

test("Disabling AI cancels in-flight work and unchanged realtime refreshes reuse analysis", async (t) => {
  const page = await mount(t); await page.analyze();
  await act(async () => page.events.get("task:updated")()); await page.analyze();
  assert.equal(page.recommendations.length, 1);
  page.account.aiPriorityEnabled = false; await page.rerender(); await page.analyze();
  assert.equal(page.recommendations.length, 1);
  page.account.aiPriorityEnabled = true; await page.rerender(); await page.analyze();
  assert.equal(page.recommendations.length, 1, "Re-enabling unchanged analysis can use the cache");
  const pending = defer(); const second = await mount(t, { recommendation: pending }); await second.analyze();
  second.account.aiPriorityEnabled = false; await second.rerender();
  assert.equal(second.recommendations[0].signal.aborted, true);
  await act(async () => pending.resolve({ summary: "Late answer", order: ["b", "a", "c"], items: [] }));
  assert.deepEqual(second.rows(), ["a", "b", "c"]);
});

test("Personal preferences stay isolated by account and blocked storage still permits edits", async (t) => {
  const page = await mount(t, { updateError: new Error("Task update failed"), blockStorage: true });
  await act(async () => page.view.root.findByProps({ "aria-label": "Status of Fix release" }).props.onChange({ target: { value: "done" } }));
  assert.equal(page.view.root.findByProps({ "aria-label": "Status of Fix release" }).props.value, "todo");
  assert.match(JSON.stringify(page.view.toJSON()), /Task update failed/);
  await page.click("Move Fix release down"); assert.deepEqual(page.rows(), ["b", "a", "c"]);
  assert.match(JSON.stringify(page.view.toJSON()), /browser could not save/);
  page.account.id = "bob"; await page.rerender(); assert.deepEqual(page.rows(), ["a", "b", "c"]);
});

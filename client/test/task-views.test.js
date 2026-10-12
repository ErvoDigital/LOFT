import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TASK_FILTERS, filterTasks, sortTasks, taskDropOrder, taskDueKey, formatTaskDue, isTaskOverdue } from "../src/lib/taskViews.js";

const statuses = [{ id: "planned", label: "Planned" }, { id: "review", label: "Review" }, { id: "shipped", label: "Shipped", isDone: true }];
const now = new Date(2026, 9, 12, 10);
const tasks = [
  { id: "a", title: "Write release notes", status: "planned", description: "For the launch", order: 1, tier: "TIER_3", dueDate: "2026-10-12T00:00:00.000Z", assignee: { id: "self", name: "Alex" } },
  { id: "b", title: "Review mockups", status: "review", order: 2, tier: "TIER_1", dueDate: "2026-10-11T00:00:00.000Z", assignee: { id: "other", name: "Riley" } },
  { id: "c", title: "QA checklist", status: "planned", order: 3, tier: "TIER_2", dueDate: null, assignee: null },
  { id: "d", title: "Archive launch", status: "shipped", order: 4, tier: "TIER_4", dueDate: "2026-10-10T00:00:00.000Z", assignee: { id: "self", name: "Alex" } },
];
const filtered = (changes) => filterTasks(tasks, { ...DEFAULT_TASK_FILTERS, ...changes }, statuses, "self", now).map((task) => task.id);

test("task filters combine search, custom statuses, priority and assignees", () => {
  assert.deepEqual(filtered({ query: "LAUNCH", assignee: "mine", status: "planned", priority: "TIER_3" }), ["a"]);
  assert.deepEqual(filtered({ query: "riley" }), ["b"]);
  assert.deepEqual(filtered({ assignee: "unassigned" }), ["c"]);
  assert.deepEqual(filtered({ assignee: "other" }), ["b"]);
});

test("task date filters exclude done tasks from overdue and treat today's date as due today", () => {
  assert.deepEqual(filtered({ due: "overdue" }), ["b"]);
  assert.deepEqual(filtered({ due: "today" }), ["a"]);
  assert.deepEqual(filtered({ due: "undated" }), ["c"]);
  assert.equal(isTaskOverdue(tasks[0], statuses, now), false);
  assert.equal(isTaskOverdue(tasks[3], statuses, now), false);
});

test("task sorting keeps missing dates and assignees last in either direction", () => {
  const original = tasks.map((task) => task.id);
  assert.deepEqual(sortTasks(tasks, { key: "dueDate", direction: "asc" }, statuses).map((task) => task.id), ["d", "b", "a", "c"]);
  assert.deepEqual(sortTasks(tasks, { key: "dueDate", direction: "desc" }, statuses).map((task) => task.id), ["a", "b", "d", "c"]);
  assert.equal(sortTasks(tasks, { key: "assignee", direction: "desc" }, statuses).at(-1).id, "c");
  assert.deepEqual(tasks.map((task) => task.id), original);
});

test("task priority and manual order follow the actual workspace status order", () => {
  assert.deepEqual(sortTasks(tasks, { key: "priority" }, statuses).map((task) => task.id), ["b", "c", "a", "d"]);
  assert.deepEqual(sortTasks(tasks, { key: "order" }, statuses).map((task) => task.id), ["a", "c", "b", "d"]);
});

test("moving down a board column places the task at the visible drop boundary", () => {
  const column = [1, 2, 3].map((order) => ({ id: String(order), status: "planned", order }));
  assert.equal(taskDropOrder(column, column, "1", "planned", 2), 2.5);
  assert.equal(taskDropOrder(column, column, "3", "planned", 0), 0);
});

test("filtered board moves preserve hidden task order and avoid colliding with it", () => {
  const column = [1, 2, 3, 4].map((order) => ({ id: String(order), status: "planned", order }));
  const visible = [column[0], column[2]];
  assert.equal(taskDropOrder(column, visible, "incoming", "planned", 1), 2.5);
  assert.equal(taskDropOrder(column, [], "incoming", "planned", 0), 5);
  assert.deepEqual(column.map((task) => task.order), [1, 2, 3, 4]);
});

test("task due dates retain the date picked in time zones west of UTC", () => {
  const previous = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    assert.equal(taskDueKey("2026-10-12T00:00:00.000Z"), "2026-10-12");
    assert.match(formatTaskDue("2026-10-12T00:00:00.000Z"), /12/);
    assert.doesNotMatch(formatTaskDue("2026-10-12T00:00:00.000Z"), /11/);
  } finally { if (previous == null) delete process.env.TZ; else process.env.TZ = previous; }
});

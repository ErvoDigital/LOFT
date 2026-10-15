import test from "node:test";
import assert from "node:assert/strict";
import { PRIORITY_LABELS, humanizePriorityTerms } from "../src/lib/priorities.js";
import { PRIORITY_LABELS as serverLabels } from "../../server/src/utils/priorities.js";
import { applyManualPlan, emptyManualPlan, manualPlanKey, movePlanItem, planDate, readManualPlan } from "../src/components/plan/manualPlan.js";
import { buildDayLanes, buildWeek, pickFocus, toPlanItems } from "../src/components/plan/planModel.js";

const now = new Date(2026, 9, 20, 9);
const tasks = [
  { id: "urgent", title: "Fix release", tier: "TIER_1", score: 1000, estimatedMinutes: 60, dueDate: new Date(2026, 9, 20, 17) },
  { id: "medium", title: "Prepare notes", tier: "TIER_3", score: 200, estimatedMinutes: 30, dueDate: new Date(2026, 9, 20, 17) },
  { id: "next", title: "Tomorrow task", tier: "TIER_2", score: 500, estimatedMinutes: 30, dueDate: new Date(2026, 9, 21, 17) },
];

test("Priority labels match across frontend and backend and legacy tier text is readable", () => {
  assert.deepEqual(PRIORITY_LABELS, serverLabels);
  assert.equal(humanizePriorityTerms("TIER_1, Tier 2, tier-3 and TIER_4 priority"), "Urgent, High, Medium and Low priority");
});

test("Manual order overrides recommendations in focus, day and week without mutating task priorities", () => {
  const items = toPlanItems(tasks, 6, now);
  const prefs = { ...emptyManualPlan(), order: ["medium", "urgent", "next"] };
  const manual = applyManualPlan(items, prefs);
  const lanes = buildDayLanes(manual, now);
  assert.deepEqual(lanes[0].items.map((item) => item.taskId), ["medium", "urgent"]);
  assert.equal(pickFocus(lanes).item.taskId, "medium");
  assert.deepEqual(buildWeek(manual, 0, now).ranked.map((item) => item.taskId), ["medium", "urgent", "next"]);
  assert.equal(tasks[0].tier, "TIER_1");
  assert.ok(items.every((item) => item.manualRank === undefined));
  assert.equal(applyManualPlan(items, emptyManualPlan(), ["medium", "urgent", "next"])[0].aiRank, 1);
});

test("Manual planned days affect every view and flag postponed deadlines without changing them", () => {
  const items = toPlanItems(tasks, 6, now);
  const prefs = { order: [], dates: { urgent: "2026-10-21" } };
  const manual = applyManualPlan(items, prefs);
  const moved = manual[0];
  assert.equal(planDate(moved), "2026-10-21T12:00:00");
  assert.equal(moved.dueDate, tasks[0].dueDate);
  assert.equal(moved.plannedAfterDeadline, true);
  assert.equal(moved.atRisk, true);
  assert.deepEqual(buildDayLanes(manual, now)[0].items.map((item) => item.taskId), ["medium"]);
  assert.ok(buildWeek(manual, 0, now).days[1].items.some((item) => item.taskId === "urgent"));
});

test("Manual preferences are account scoped, tolerate blocked storage and discard malformed dates", () => {
  const values = new Map([[manualPlanKey("alice"), JSON.stringify({ order: ["medium", "medium", "urgent"], dates: { urgent: "2026-02-30", medium: "2026-10-21" } })]]);
  const storage = { getItem: (key) => values.get(key) };
  assert.deepEqual(readManualPlan("alice", storage), { order: ["medium", "urgent"], dates: { medium: "2026-10-21" } });
  assert.deepEqual(readManualPlan("bob", storage), emptyManualPlan());
  assert.deepEqual(readManualPlan("alice", { getItem() { throw Error("blocked"); } }), emptyManualPlan());
  const prefs = { order: ["urgent", "medium", "next"], dates: {} };
  assert.deepEqual(movePlanItem(prefs, toPlanItems(tasks, 6, now).slice(0, 2), "urgent", 1).order, ["medium", "urgent", "next"]);
  assert.equal(movePlanItem(prefs, toPlanItems(tasks, 6, now), "urgent", -1), prefs);
});

test("Pinned work remains ahead of AI ranking while explicit personal order still takes precedence", () => {
  const items = toPlanItems(tasks.map((task) => ({ ...task, isPinned: task.id === "next" })), 6, now);
  const auto = applyManualPlan(items, emptyManualPlan(), ["medium", "urgent", "next"]);
  assert.equal(pickFocus(buildDayLanes(auto, now)).item.taskId, "next");
  const manual = applyManualPlan(items, { order: ["medium"], dates: {} }, ["next", "urgent", "medium"]);
  assert.equal(pickFocus(buildDayLanes(manual, now)).item.taskId, "medium");
});

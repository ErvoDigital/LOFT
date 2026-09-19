// My Plan's client-side model: groups the plan's open tasks by due date
// (Day by day) or into 7-day windows (Week), and ranks each group by the
// Smart Priority score the server attached to every task. Grouping happens
// here rather than on the server so "today" is the viewer's local day, not
// the server's UTC one.
import { dayKey, startOfDay } from "../dashboard/fortnight.js";

export const WEEK_LENGTH = 7;

function addDays(date, n) {
  // setDate rather than adding 24h, which drifts an hour across DST changes.
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / 86400000);
}

// Highest score first. Ties fall back to the earlier deadline, then the
// title, so the order is stable between reloads.
function byPriority(a, b) {
  return (
    (b.score ?? 0) - (a.score ?? 0) ||
    new Date(a.dueDate || 8.64e15) - new Date(b.dueDate || 8.64e15) ||
    a.title.localeCompare(b.title)
  );
}

function sumHours(items) {
  return Math.round(items.reduce((n, it) => n + it.hours, 0) * 100) / 100;
}

export function formatHours(hours) {
  return `${Math.round(hours * 10) / 10}h`;
}

// The shape PlanTaskRow and MyPlan's handlers read: `taskId` and `hours`
// (30 minutes when there's no estimate, as the server's planner assumes),
// plus `atRisk`/`shortfallHours` from markAtRisk below.
export function toPlanItems(tasks = [], capacity, now = new Date()) {
  const items = tasks.map((t) => ({
    ...t,
    taskId: t.id,
    hours: Math.round(((t.estimatedMinutes ?? 30) / 60) * 100) / 100,
    atRisk: false,
    shortfallHours: 0,
  }));
  markAtRisk(items, capacity, now);
  return items;
}

// A task is at risk when, working through everything in deadline order at
// the daily hours, there's no room left for it by the end of its due date.
// Deadline order finds room wherever it exists — Tuesday's work can start on
// a clear Monday — and priority only decides which of a day's tasks is the
// one left over. Overdue work is due now, so it counts against today.
function markAtRisk(items, capacity, now) {
  const today = startOfDay(now);
  const queue = items
    .filter((it) => it.dueDate)
    .map((it) => ({ it, day: Math.max(0, daysBetween(today, it.dueDate)) }))
    .sort((a, b) => a.day - b.day || byPriority(a.it, b.it));

  let booked = 0;
  for (const { it, day } of queue) {
    booked += it.hours;
    const room = capacity * (day + 1);
    if (booked > room + 1e-9) {
      it.atRisk = true;
      it.shortfallHours = Math.round(Math.min(it.hours, booked - room) * 100) / 100;
    }
  }
}

// Day by day: every task sits on its own due date and is ranked only against
// the others due that day. Overdue tasks share one lane ahead of today, tasks
// with no due date close the list, and today and tomorrow always get a lane
// so an empty day still reads as a clear day rather than a missing one.
export function buildDayLanes(items, now = new Date()) {
  const today = startOfDay(now);
  const overdue = [];
  const undated = [];
  const byKey = new Map();
  const laneFor = (date) => {
    const key = dayKey(date);
    if (!byKey.has(key)) byKey.set(key, { key, date, items: [] });
    return byKey.get(key);
  };

  laneFor(today);
  laneFor(addDays(today, 1));
  for (const item of items) {
    if (!item.dueDate) undated.push(item);
    else if (startOfDay(item.dueDate) < today) overdue.push(item);
    else laneFor(startOfDay(item.dueDate)).items.push(item);
  }

  let previous = null;
  const dayLanes = [...byKey.values()]
    .sort((a, b) => a.date - b.date)
    .map((lane) => {
      const offset = daysBetween(today, lane.date);
      const clearDays = previous === null ? 0 : offset - previous - 1;
      previous = offset;
      return { ...lane, kind: "day", offset, clearDays, items: lane.items.sort(byPriority), hours: sumHours(lane.items) };
    });

  const lanes = [];
  if (overdue.length) {
    lanes.push({ key: "overdue", kind: "overdue", items: overdue.sort(byPriority), hours: sumHours(overdue) });
  }
  lanes.push(...dayLanes);
  if (undated.length) {
    lanes.push({ key: "undated", kind: "undated", items: undated.sort(byPriority), hours: sumHours(undated) });
  }
  return lanes;
}

// Week: seven days starting today (page 0), or `page` weeks after that. Every
// task due in the window is ranked against the whole week at once, so a
// Tier 1 due Friday can outrank a Tier 3 due today. Page 0 also carries
// overdue tasks in, since this week is when they have to be dealt with.
export function buildWeek(items, page = 0, now = new Date()) {
  const today = startOfDay(now);
  const start = addDays(today, page * WEEK_LENGTH);
  const days = Array.from({ length: WEEK_LENGTH }, (_, i) => {
    const date = addDays(start, i);
    return { key: dayKey(date), date, offset: page * WEEK_LENGTH + i, items: [] };
  });
  const byKey = new Map(days.map((d) => [d.key, d]));
  const overdue = [];

  for (const item of items) {
    if (!item.dueDate) continue;
    const due = startOfDay(item.dueDate);
    if (due < today) {
      if (page === 0) overdue.push(item);
    } else {
      byKey.get(dayKey(due))?.items.push(item);
    }
  }

  const ranked = [...overdue, ...days.flatMap((d) => d.items)].sort(byPriority);
  const rankById = new Map(ranked.map((it, i) => [it.taskId, i + 1]));
  for (const d of days) {
    d.items.sort(byPriority);
    d.hours = sumHours(d.items);
  }
  overdue.sort(byPriority);

  return {
    start,
    end: addDays(start, WEEK_LENGTH - 1),
    days,
    overdue: { key: "overdue", items: overdue, hours: sumHours(overdue) },
    ranked,
    rankById,
    hours: sumHours(ranked),
  };
}

// The one task the hero puts forward, and why: the top-ranked of everything
// overdue or due today; failing that, the top of the soonest day with
// something due; failing that, the top task with no date. Snoozed tasks are
// never put forward.
export function pickFocus(lanes) {
  const awake = (kind, test = () => true) =>
    lanes.filter((l) => l.kind === kind && test(l)).flatMap((l) => l.items.filter((it) => !it.isSnoozed));

  const overdue = awake("overdue");
  const now = [...overdue, ...awake("day", (l) => l.offset === 0)].sort(byPriority);
  if (now.length) return { item: now[0], reason: overdue.includes(now[0]) ? "overdue" : "today" };

  const next = lanes.find((l) => l.kind === "day" && l.items.some((it) => !it.isSnoozed));
  if (next) return { item: next.items.find((it) => !it.isSnoozed), reason: "next" };

  const undated = awake("undated");
  return undated.length ? { item: undated[0], reason: "undated" } : null;
}

// "Today", "Tomorrow", or the weekday — the heading a day lane goes by.
export function relativeDayName(offset, date) {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return date.toLocaleDateString([], { weekday: "long" });
}

// Where a task falls, in the few words a row has room for: "Today",
// "Tue 22", or "Overdue · Sep 17".
export function whenLabel(item, now = new Date()) {
  if (!item.dueDate) return "No due date";
  const offset = daysBetween(now, item.dueDate);
  const due = new Date(item.dueDate);
  if (offset < 0) return `Overdue · ${due.toLocaleDateString([], { month: "short", day: "numeric" })}`;
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return shortDay(due, offset > 6);
}

// "Thu 24", or "Thu, Oct 1" when the month is worth saying. Built by hand
// because Chrome renders the weekday + day-only format as "24 Thu".
export function shortDay(date, withMonth = false) {
  if (withMonth) return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  return `${date.toLocaleDateString([], { weekday: "short" })} ${date.getDate()}`;
}

export function daysLate(item, now = new Date()) {
  return item.dueDate ? Math.max(0, daysBetween(item.dueDate, now)) : 0;
}

// The dashboard's shared model of the next two weeks — one entry per day,
// today first. The hero skyline, the agenda and the summary line all read
// from it, so they can never disagree about what falls on which day. A
// workspace overview builds the same model over a single week.
export const HORIZON_DAYS = 14;

export function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dayKey(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function buildFortnight({ events, tasks, conflicts, length = HORIZON_DAYS }) {
  const today = startOfDay(new Date());
  const days = Array.from({ length }, (_, i) => {
    // setDate rather than adding 24h, which drifts an hour across DST changes.
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    return { key: dayKey(date), index: i, date, meetings: [], deadlines: [], clash: false };
  });
  const byKey = new Map(days.map((d) => [d.key, d]));

  for (const e of events || []) byKey.get(dayKey(e.startTime))?.meetings.push(e);
  for (const t of tasks || []) if (t.dueDate) byKey.get(dayKey(t.dueDate))?.deadlines.push(t);
  for (const c of conflicts || []) {
    for (const item of c.items) {
      const day = item.time && byKey.get(dayKey(item.time));
      if (day) day.clash = true;
    }
  }
  return days;
}

export function countPhrase(n, noun) {
  if (n === 0) return `no ${noun}s`;
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

// "Today", "Tomorrow", or a short date — how a day is named in running text.
export function dayName(day) {
  if (day.index === 0) return "Today";
  if (day.index === 1) return "Tomorrow";
  return day.date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function dayDetails(day) {
  const parts = [];
  if (day.meetings.length) parts.push(countPhrase(day.meetings.length, "meeting"));
  if (day.deadlines.length) parts.push(`${day.deadlines.length} due`);
  if (day.clash) parts.push("clash");
  return parts.length ? parts.join(" · ") : "nothing scheduled";
}

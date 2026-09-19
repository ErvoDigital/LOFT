// Date math and labels shared by the workspace calendar's month grid, week
// time grid and day panel, so all three agree on which day an event falls on.
export const MINUTES_IN_DAY = 24 * 60;

export function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

// setDate rather than adding 24h, which drifts an hour across DST changes.
export function addDays(value, n) {
  const d = new Date(value);
  d.setDate(d.getDate() + n);
  return d;
}

export const startOfMonth = (value) => new Date(value.getFullYear(), value.getMonth(), 1);
export const startOfWeek = (value) => addDays(startOfDay(value), -value.getDay());
export const sameDay = (a, b) => !!a && !!b && a.toDateString() === b.toDateString();
export const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
export const byStart = (a, b) => new Date(a.startTime) - new Date(b.startTime);

// The first of `month`, moved to `day` (clamped: the 31st in a 30-day month
// lands on the 30th).
export function withDayOfMonth(month, day) {
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return new Date(month.getFullYear(), month.getMonth(), Math.min(day, last));
}

// Sunday-first weeks covering the month: four to six rows, never a trailing
// row made only of next month's days.
export function monthWeeks(monthDate) {
  const first = startOfMonth(monthDate);
  const lastDate = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const count = Math.ceil((first.getDay() + lastDate) / 7);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: count }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

// Events touching a day, earliest first. An event that runs past midnight
// shows on each day it covers; one ending exactly at midnight does not spill
// into the next.
export function eventsOnDay(events, day) {
  const from = startOfDay(day);
  const to = addDays(from, 1);
  return events.filter((e) => new Date(e.startTime) < to && new Date(e.endTime) > from).sort(byStart);
}

// eventsOnDay for every day in [from, to), keyed by dayKey.
export function bucketByDay(events, from, to) {
  const map = new Map();
  for (const e of events) {
    const start = new Date(e.startTime);
    const end = new Date(e.endTime);
    if (end <= from || start >= to) continue;
    for (let d = startOfDay(start < from ? from : start); d < end && d < to; d = addDays(d, 1)) {
      const key = dayKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
  }
  for (const list of map.values()) list.sort(byStart);
  return map;
}

const clock = (d) => d.getHours() * 60 + d.getMinutes();

// Minutes past midnight at which the event starts and ends on `day`, clipped
// to that day. Read off the wall clock rather than subtracting timestamps, so
// a DST switch doesn't shift the afternoon by an hour.
export function spanOnDay(event, day) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  return {
    start: sameDay(start, day) ? clock(start) : 0,
    end: sameDay(end, day) ? clock(end) : MINUTES_IN_DAY,
  };
}

export const minutesOfDay = clock;

// Time on the day that isn't free, with overlapping events counted once.
export function bookedMinutes(events, day) {
  const spans = events.map((e) => spanOnDay(e, day)).sort((a, b) => a.start - b.start);
  let total = 0;
  let cursor = -1;
  for (const { start, end } of spans) {
    const from = Math.max(start, cursor);
    if (end > from) total += end - from;
    cursor = Math.max(cursor, end);
  }
  return total;
}

// Side-by-side columns for overlapping events in a day's time grid. Events
// that overlap, directly or through a chain, form a cluster that shares its
// width; each takes the leftmost column free at its start. Blocks shorter than
// `minMinutes` are laid out at that length, since that's how tall they draw.
export function layoutDay(events, day, minMinutes = 20) {
  const items = events
    .map((event) => {
      const { start, end } = spanOnDay(event, day);
      return { event, start, end, drawnEnd: Math.min(MINUTES_IN_DAY, Math.max(end, start + minMinutes)) };
    })
    .sort((a, b) => a.start - b.start || b.drawnEnd - a.drawnEnd);

  const placed = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const columns = [];
    for (const item of cluster) {
      let col = columns.findIndex((end) => end <= item.start);
      if (col === -1) {
        col = columns.length;
        columns.push(item.drawnEnd);
      } else {
        columns[col] = item.drawnEnd;
      }
      item.col = col;
    }
    for (const item of cluster) placed.push({ ...item, cols: columns.length });
    cluster = [];
  };

  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) flush();
    clusterEnd = cluster.length ? Math.max(clusterEnd, item.drawnEnd) : item.drawnEnd;
    cluster.push(item);
  }
  if (cluster.length) flush();
  return placed;
}

// ---- Labels ----------------------------------------------------------------------

export const timeLabel = (value) => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// "9 AM", "9:30 AM": drops ":00" where space is tight.
export function shortTime(value) {
  const d = new Date(value);
  return d.toLocaleTimeString([], d.getMinutes() ? { hour: "numeric", minute: "2-digit" } : { hour: "numeric" });
}

export function durationLabel(minutes) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} hr ${rest} min` : `${h} hr`;
}

export const eventMinutes = (e) => (new Date(e.endTime) - new Date(e.startTime)) / 60000;

const relative = new Intl.RelativeTimeFormat([], { numeric: "auto" });
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// "Today", "Tomorrow", "In 3 days", "2 weeks ago", counted in calendar days.
export function relativeDay(day, now) {
  const diff = Math.round((startOfDay(day) - startOfDay(now)) / 86400000);
  if (Math.abs(diff) < 14) return capitalize(relative.format(diff, "day"));
  if (Math.abs(diff) < 60) return capitalize(relative.format(Math.round(diff / 7), "week"));
  return capitalize(relative.format(Math.round(diff / 30), "month"));
}

// "today at 9 AM", "tomorrow at 2:30 PM", "Mon, Sep 21 at 9 AM".
export function whenLabel(value, now) {
  const d = new Date(value);
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  const day =
    diff === 0 || diff === 1
      ? relative.format(diff, "day")
      : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  return `${day} at ${shortTime(d)}`;
}

// Where an event stands against the clock, for the badges in the day panel.
export function eventStatus(event, now) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  if (end <= now) return { kind: "past", label: "Ended" };
  if (start <= now) return { kind: "live", label: "Now" };
  const minutes = Math.ceil((start - now) / 60000);
  if (minutes <= 60) return { kind: "soon", label: `In ${minutes} min` };
  return { kind: "upcoming", label: null };
}

// ---- Locations -------------------------------------------------------------------

// ScheduleMeetingModal stores the workspace's call URL as the event location.
// Returns just its path, so the link opens in this tab under whichever host
// the app is served from rather than the one the meeting was scheduled on.
export function meetingPath(location) {
  if (!location) return null;
  try {
    const { pathname } = new URL(location);
    return /^\/workspaces\/[^/]+\/meeting\/?$/.test(pathname) ? pathname : null;
  } catch {
    return null;
  }
}

export function externalUrl(location) {
  if (!location || !/^https?:\/\//i.test(location.trim())) return null;
  try {
    return new URL(location.trim());
  } catch {
    return null;
  }
}

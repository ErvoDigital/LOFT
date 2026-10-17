export function dayInZone(value, timeZone = "Asia/Manila") {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (name) => parts.find((part) => part.type === name).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function addDayKey(day, count) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function zonedInstant(day, clock = "00:00", timeZone = "Asia/Manila") {
  const target = Date.parse(`${day}T${clock}:00Z`);
  let guess = target;
  for (let i = 0; i < 5; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
    const p = (type) => parts.find((part) => part.type === type).value;
    const displayed = Date.parse(`${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:${p("second")}Z`);
    const next = guess + target - displayed;
    if (next === guess) return new Date(guess);
    guess = next;
  }
  throw new Error("This local time does not exist in the selected time zone");
}
export function mergedDuration(intervals) {
  let total = 0, end = -Infinity;
  for (const [start, stop] of intervals.sort((a, b) => a[0] - b[0])) {
    if (stop > end) total += stop - Math.max(start, end);
    end = Math.max(end, stop);
  }
  return total;
}
export function buildCapacityCalendar({ now = new Date(), timeZone = "Asia/Manila", dailyCapacityHours = 6, hoursByWeekday, accountForMeetings = false, events = [], horizonDays = 30 }) {
  const today = dayInZone(now, timeZone);
  const result = {};
  for (let i = 0; i <= horizonDays; i++) {
    const key = addDayKey(today, i);
    const working = hoursByWeekday?.[new Date(`${key}T12:00:00Z`).getUTCDay()] ?? dailyCapacityHours;
    let meetingHours = 0;
    if (accountForMeetings) {
      const from = +zonedInstant(key, "00:00", timeZone), to = +zonedInstant(addDayKey(key, 1), "00:00", timeZone);
      const ranges = events.map((event) => [Math.max(from, +new Date(event.startTime)), Math.min(to, +new Date(event.endTime))]).filter(([a, b]) => a < b);
      meetingHours = mergedDuration(ranges) / 3600000;
    }
    result[key] = { workingHours: working, meetingHours: Math.round(meetingHours * 100) / 100, availableHours: Math.max(0, working - meetingHours) };
  }
  return result;
}


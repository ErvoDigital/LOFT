import { z } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { addDayKey, dayInZone, zonedInstant } from "../../../shared/time.js";
import { timeZoneSchema } from "./preferences.js";

export const recurrenceSchema = z.object({ frequency: z.enum(["DAILY", "WEEKLY"]), count: z.number().int().min(2).max(52), timeZone: timeZoneSchema }).strict();
export function expandRecurrence(startTime, endTime, recurrence) {
  if (!recurrence) return [{ startTime, endTime }];
  const rule = recurrenceSchema.parse(recurrence);
  const day = dayInZone(startTime, rule.timeZone);
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: rule.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(startTime));
  const duration = new Date(endTime) - new Date(startTime);
  try {
    return Array.from({ length: rule.count }, (_, index) => {
      const start = index === 0 ? new Date(startTime) : zonedInstant(addDayKey(day, index * (rule.frequency === "WEEKLY" ? 7 : 1)), clock, rule.timeZone);
      return { startTime: start, endTime: new Date(+start + duration) };
    });
  } catch { throw new ApiError(400, "One occurrence falls at a local time that does not exist. Choose a different start time."); }
}
export function availableSlots({ startTime, endTime, busyEvents, timeZone = "Asia/Manila", now = new Date() }) {
  const duration = new Date(endTime) - new Date(startTime);
  if (duration <= 0 || duration > 9 * 3600000) return [];
  const firstDay = dayInZone(new Date(Math.max(+now, +new Date(startTime))), timeZone);
  const slots = [];
  for (let offset = 0; offset < 8 && slots.length < 5; offset++) {
    const day = addDayKey(firstDay, offset);
    if ([0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay())) continue;
    for (let minute = 9 * 60; minute + duration / 60000 <= 18 * 60 && slots.length < 5; minute += 30) {
      const from = zonedInstant(day, `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`, timeZone);
      const to = new Date(+from + duration);
      if (from <= now || busyEvents.some((event) => from < new Date(event.endTime) && new Date(event.startTime) < to)) continue;
      if (+from === +new Date(startTime)) continue;
      slots.push({ startTime: from.toISOString(), endTime: to.toISOString() });
    }
  }
  return slots;
}

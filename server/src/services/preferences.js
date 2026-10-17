import { z } from "zod";

export const timeZoneSchema = z.string().max(100).refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}, "Invalid time zone");
export const planDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString().slice(0, 10) === value, "Invalid planned day");
export const planPreferencesSchema = z.object({
  dailyCapacityHours: z.number().min(1).max(16).default(6),
  hoursByWeekday: z.array(z.number().min(0).max(16)).length(7).optional(),
  accountForMeetings: z.boolean().default(false),
  timeZone: timeZoneSchema.default("Asia/Manila"),
  order: z.array(z.string().min(1).max(100)).max(1000).default([]),
  dates: z.record(z.string().min(1).max(100), planDaySchema).refine((value) => Object.keys(value).length <= 1000).default({}),
}).strict();
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const notificationPreferencesSchema = z.object({
  disabledTypes: z.array(z.string().max(60)).max(30).default([]),
  mutedWorkspaceIds: z.array(z.string().max(100)).max(200).default([]),
  quietHours: z.object({ enabled: z.boolean(), start: clock, end: clock }).strict().default({ enabled: false, start: "22:00", end: "08:00" }),
  timeZone: timeZoneSchema.default("Asia/Manila"),
  eventReminderMinutes: z.number().int().min(0).max(10080).default(15),
  taskReminderMinutes: z.number().int().min(0).max(10080).default(1440),
}).strict();
export function readPreferences(value, schema) {
  try { return schema.parse(typeof value === "string" ? JSON.parse(value) : value || {}); }
  catch { return schema.parse({}); }
}
export function zonedDay(value, timeZone = "Asia/Manila") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
export function quietNow(preferences, now = new Date()) {
  const quiet = preferences.quietHours;
  if (!quiet.enabled || quiet.start === quiet.end) return false;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: preferences.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  return quiet.start < quiet.end ? time >= quiet.start && time < quiet.end : time >= quiet.start || time < quiet.end;
}

export function isWorkspaceMeeting(event, workspaceId) {
  try {
    return new URL(event.location, "https://loft.local").pathname.replace(/\/$/, "") === `/workspaces/${workspaceId}/meeting`;
  } catch { return false; }
}

export function meetingDuration(start, end) {
  return Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000));
}

export function toLocalMeetingInput(value) {
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function nextMeetingSlot(now = new Date()) {
  const start = new Date(now);
  start.setMinutes(Math.floor(start.getMinutes() / 30) * 30 + 30, 0, 0);
  return start;
}

export function validateMeeting({ title, startTime, endTime, attendeeIds }, { editing = false, now = Date.now() } = {}) {
  if (!title.trim()) return "Give your meeting a title.";
  if (!startTime || !endTime || !Number.isFinite(new Date(startTime).getTime()) || !Number.isFinite(new Date(endTime).getTime())) return "Choose a valid start and end time.";
  if (new Date(endTime) <= new Date(startTime)) return "End time must be after start time.";
  if (!editing && new Date(startTime).getTime() < now) return "Choose a start time in the future.";
  if (attendeeIds && !attendeeIds.length) return "Choose at least one attendee.";
  return "";
}

export function elapsedMeetingTime(joinedAt, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - joinedAt) / 1000));
  const pad = (number) => String(number).padStart(2, "0");
  return seconds >= 3600 ? `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}` : `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

// RFC 5545: UTC timestamps, escaped TEXT fields and lines folded at 75 octets.
export function meetingCalendarFile(event, now = new Date()) {
  const escape = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
  const utc = (value) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const fold = (line) => {
    let result = "", bytes = 0;
    for (const character of line) {
      const length = new TextEncoder().encode(character).length;
      if (bytes + length > 75) { result += "\r\n "; bytes = 1; }
      result += character; bytes += length;
    }
    return result;
  };
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SyncTayo//Meetings//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT", `UID:${escape(event.id)}@loft`, `DTSTAMP:${utc(now)}`, `DTSTART:${utc(event.startTime)}`, `DTEND:${utc(event.endTime)}`, `SUMMARY:${escape(event.title)}`, `DESCRIPTION:${escape(event.description)}`, `LOCATION:${escape(event.location)}`, "END:VEVENT", "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
}

export function downloadMeetingCalendar(event) {
  const url = URL.createObjectURL(new Blob([meetingCalendarFile(event)], { type: "text/calendar;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${event.title.replace(/[^\p{L}\p{N} -]/gu, "").slice(0, 80) || "meeting"}.ics`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

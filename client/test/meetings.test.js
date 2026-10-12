import test from "node:test";
import assert from "node:assert/strict";
import { elapsedMeetingTime, isWorkspaceMeeting, meetingCalendarFile, meetingDuration, nextMeetingSlot, validateMeeting } from "../src/lib/meetings.js";

test("meeting rooms survive host changes and exclude other workspace events", () => {
  assert.equal(isWorkspaceMeeting({ location: "https://old.example/workspaces/team/meeting/" }, "team"), true);
  assert.equal(isWorkspaceMeeting({ location: "/workspaces/team/meeting" }, "team"), true);
  assert.equal(isWorkspaceMeeting({ location: "https://app.example/workspaces/other/meeting" }, "team"), false);
  assert.equal(isWorkspaceMeeting({ location: "Room 12" }, "team"), false);
});

test("scheduling validates times and attendees while allowing edits to ongoing meetings", () => {
  const data = { title: "Team sync", startTime: "2026-10-12T08:00:00Z", endTime: "2026-10-12T08:30:00Z", attendeeIds: ["alex"] };
  const now = new Date("2026-10-12T09:00:00Z").getTime();
  assert.match(validateMeeting(data, { now }), /future/);
  assert.equal(validateMeeting(data, { now, editing: true }), "");
  assert.match(validateMeeting({ ...data, endTime: data.startTime }, { editing: true }), /after/);
  assert.match(validateMeeting({ ...data, title: "  " }), /title/);
  assert.match(validateMeeting({ ...data, startTime: "invalid" }), /valid/);
  assert.match(validateMeeting({ ...data, attendeeIds: [] }, { editing: true }), /attendee/);
});

test("default scheduling rounds up across hours and elapsed time handles long calls", () => {
  const start = new Date(2026, 9, 12, 23, 45);
  const slot = nextMeetingSlot(start);
  assert.equal(slot.getDate(), 13); assert.equal(slot.getHours(), 0); assert.equal(slot.getMinutes(), 0);
  assert.equal(meetingDuration(start, slot), 15);
  assert.equal(elapsedMeetingTime(1000, 66000), "01:05");
  assert.equal(elapsedMeetingTime(1000, 3662000), "1:01:01");
});

test("calendar downloads preserve UTC, escape text and fold Unicode lines", () => {
  const event = { id: "meeting", title: "Design; review, planning", description: "Line one\n" + "👋".repeat(50), location: "https://example.test/meeting", startTime: "2026-10-12T08:00:00+08:00", endTime: "2026-10-12T08:30:00+08:00" };
  const file = meetingCalendarFile(event, new Date("2026-10-01T00:00:00Z"));
  assert.ok(file.includes("DTSTART:20261012T000000Z\r\n"));
  assert.ok(file.includes("SUMMARY:Design\\; review\\, planning"));
  assert.ok(file.replace(/\r\n /g, "").includes("DESCRIPTION:Line one\\n" + "👋".repeat(50)));
  for (const line of file.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75);
});

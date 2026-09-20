import { Link } from "react-router-dom";
import { CalendarX, Clock, Link2, MapPin, Pencil, Users, Video } from "lucide-react";
import Modal from "../common/Modal.jsx";
import Avatar from "../common/Avatar.jsx";
import {
  durationLabel,
  eventMinutes,
  eventStatus,
  externalUrl,
  meetingPath,
  relativeDay,
  sameDay,
  timeLabel,
} from "./calendarDates.js";

// "Saturday, September 20" — plus the year when the event isn't in this one.
function dateLabel(value, now) {
  const d = new Date(value);
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

// The full span in words. An event that runs past midnight spells out both
// dates rather than showing a time range that reads as same-day.
function whenText(event, now) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  if (sameDay(start, end)) {
    return `${dateLabel(start, now)} · ${timeLabel(start)} – ${timeLabel(end)}`;
  }
  return `${dateLabel(start, now)}, ${timeLabel(start)} – ${dateLabel(end, now)}, ${timeLabel(end)}`;
}

function Row({ icon: Icon, children }) {
  return (
    <div className="flex min-w-0 gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400 dark:text-ink-500" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm text-ink-700 dark:text-ink-200">{children}</div>
    </div>
  );
}

// A meeting link becomes a real join button; any other URL opens in a new
// tab; anything else is plain text. Mirrors the day panel's compact version.
function LocationRow({ location, status }) {
  const path = meetingPath(location);
  if (path) {
    const joinable = status.kind === "live" || status.kind === "soon";
    return (
      <Row icon={Video}>
        <Link to={path} className={joinable ? "btn-primary !py-1.5 !text-xs" : "font-medium text-brand-600 hover:underline dark:text-brand-300"}>
          {joinable ? "Join call" : "Video call"}
        </Link>
      </Row>
    );
  }
  const url = externalUrl(location);
  if (url) {
    return (
      <Row icon={Link2}>
        <a href={url.href} target="_blank" rel="noreferrer" className="break-all font-medium text-brand-600 hover:underline dark:text-brand-300">
          {location}
        </a>
      </Row>
    );
  }
  return (
    <Row icon={MapPin}>
      <span className="break-words">{location}</span>
    </Row>
  );
}

// What opening an event in the calendar shows: everything about it, read-only.
// Editing and cancelling are admin-only (enforced again on the API side, in
// events.routes.js), so members get the same full picture without the risk of
// nudging a shared calendar out from under everyone else.
export default function EventDetailsModal({ open, onClose, event, now, canManage, createdByName, onEdit, onCancelEvent }) {
  if (!event) return null;

  const status = eventStatus(event, now);
  const attendees = event.attendees || [];

  return (
    <Modal open={open} onClose={onClose} title="Event details" width="max-w-lg">
      <div className="space-y-5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 break-words text-lg font-semibold leading-snug tracking-tight text-ink-900 dark:text-ink-50">
              {event.title}
            </h3>
            {status.kind === "live" && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-400/15 dark:text-brand-200">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
                </span>
                Now
              </span>
            )}
            {status.kind === "past" && (
              <span className="shrink-0 text-[11px] font-medium text-ink-400 dark:text-ink-500">Ended</span>
            )}
          </div>
          {createdByName && <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">Created by {createdByName}</p>}
        </div>

        <div className="space-y-3">
          <Row icon={Clock}>
            <p className="break-words">{whenText(event, now)}</p>
            <p className="mt-0.5 text-xs text-ink-400 dark:text-ink-500">
              {relativeDay(new Date(event.startTime), now)} · {durationLabel(eventMinutes(event))}
              {status.kind === "soon" ? ` · ${status.label}` : ""}
            </p>
          </Row>

          {event.location && <LocationRow location={event.location} status={status} />}

          {attendees.length > 0 && (
            <Row icon={Users}>
              <p className="text-xs font-medium text-ink-500 dark:text-ink-400">
                {attendees.length} {attendees.length === 1 ? "attendee" : "attendees"}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {attendees.map((person) => (
                  <span
                    key={person.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink-900/[0.08] bg-white/60 py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-ink-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-200"
                  >
                    <Avatar name={person.name} color={person.avatarColor} size={20} />
                    {person.name}
                  </span>
                ))}
              </div>
            </Row>
          )}
        </div>

        {event.description && (
          <p className="whitespace-pre-wrap break-words border-t border-ink-900/[0.08] pt-4 text-sm leading-relaxed text-ink-600 dark:border-white/[0.08] dark:text-ink-300">
            {event.description}
          </p>
        )}

        {canManage ? (
          <div className="flex items-center gap-2 border-t border-ink-900/[0.08] pt-4 dark:border-white/[0.08]">
            <button type="button" onClick={onEdit} className="btn-primary flex-1">
              <Pencil className="h-4 w-4" /> Edit event
            </button>
            <button type="button" onClick={onCancelEvent} className="btn-danger">
              <CalendarX className="h-4 w-4" /> Cancel event
            </button>
          </div>
        ) : (
          <p className="border-t border-ink-900/[0.08] pt-4 text-xs text-ink-400 dark:border-white/[0.08] dark:text-ink-500">
            Only workspace admins can edit or cancel this event.
          </p>
        )}
      </div>
    </Modal>
  );
}

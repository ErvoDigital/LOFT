import { Link } from "react-router-dom";
import { CalendarPlus, Link2, MapPin, Plus, Video } from "lucide-react";
import Avatar from "../common/Avatar.jsx";
import {
  MINUTES_IN_DAY,
  bookedMinutes,
  durationLabel,
  eventMinutes,
  eventStatus,
  externalUrl,
  meetingPath,
  minutesOfDay,
  relativeDay,
  sameDay,
  shortTime,
  spanOnDay,
  timeLabel,
} from "./calendarDates.js";

const MAX_AVATARS = 4;
const STRIP_MARKS = [0, 6, 12, 18, 24];

// The selected day's 24 hours as one bar: where it's booked, and where "now"
// is when the day is today.
function DayStrip({ day, events, now }) {
  const isToday = sameDay(day, now);
  return (
    <div className="mt-5" aria-hidden="true">
      <div className="relative h-2 rounded-full bg-white/15">
        {events.map((e) => {
          const { start, end } = spanOnDay(e, day);
          return (
            <span
              key={e.id}
              className="absolute inset-y-0 rounded-full bg-white/90 shadow-[0_0_10px_rgb(255_255_255/0.35)]"
              style={{ left: `${(start / MINUTES_IN_DAY) * 100}%`, width: `max(${((end - start) / MINUTES_IN_DAY) * 100}%, 4px)` }}
            />
          );
        })}
        {isToday && (
          <span
            className="absolute -inset-y-1 w-[3px] -translate-x-1/2 rounded-full bg-accent-300 shadow-[0_0_8px_rgb(252_211_77/0.7)]"
            style={{ left: `${(minutesOfDay(now) / MINUTES_IN_DAY) * 100}%` }}
          />
        )}
      </div>
      <div className="relative mt-1.5 h-3 text-[10px] font-medium tabular-nums text-brand-100/80">
        {STRIP_MARKS.map((h, i) => {
          const last = i === STRIP_MARKS.length - 1;
          return (
            <span
              key={h}
              className={`absolute whitespace-nowrap ${i === 0 ? "left-0" : last ? "right-0" : "-translate-x-1/2"}`}
              style={last || i === 0 ? undefined : { left: `${(h / 24) * 100}%` }}
            >
              {new Date(2000, 0, 1, h % 24).toLocaleTimeString([], { hour: "numeric" })}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function StatusTag({ status }) {
  if (status.kind === "live") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-400/15 dark:text-brand-200">
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
        </span>
        Now
      </span>
    );
  }
  if (status.kind === "soon") {
    return <span className="shrink-0 text-[11px] font-semibold text-brand-600 dark:text-brand-300">{status.label}</span>;
  }
  if (status.kind === "past") {
    return <span className="shrink-0 text-[11px] font-medium text-ink-400 dark:text-ink-500">{status.label}</span>;
  }
  return null;
}

function Location({ location, status }) {
  const path = meetingPath(location);
  if (path) {
    const joinable = status.kind === "live" || status.kind === "soon";
    return (
      <Link
        to={path}
        className={
          joinable
            ? "btn-primary pointer-events-auto relative z-10 !gap-1.5 !rounded-lg !px-2.5 !py-1 !text-xs"
            : "pointer-events-auto relative z-10 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
        }
      >
        <Video className="h-3.5 w-3.5" />
        {joinable ? "Join call" : "Video call"}
      </Link>
    );
  }
  const url = externalUrl(location);
  if (url) {
    return (
      <a
        href={url.href}
        target="_blank"
        rel="noreferrer"
        className="pointer-events-auto relative z-10 inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
      >
        <Link2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{url.hostname.replace(/^www\./, "")}</span>
      </a>
    );
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
      <MapPin className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{location}</span>
    </span>
  );
}

function Attendees({ people }) {
  if (!people?.length) return null;
  const shown = people.slice(0, MAX_AVATARS);
  const names = people.map((p) => p.name).join(", ");
  return (
    <span className="ml-auto flex shrink-0 items-center">
      <span className="sr-only">Attending: {names}</span>
      <span className="flex -space-x-1.5" aria-hidden="true">
        {shown.map((p) => (
          <span key={p.id} className="rounded-full ring-2 ring-white dark:ring-ink-900">
            <Avatar name={p.name} color={p.avatarColor} size={20} />
          </span>
        ))}
      </span>
      {people.length > MAX_AVATARS && (
        <span className="ml-1.5 text-[11px] font-medium text-ink-500 dark:text-ink-400" aria-hidden="true">
          +{people.length - MAX_AVATARS}
        </span>
      )}
    </span>
  );
}

// The line down the time column that ties the day's entries together; it
// starts at the first dot and stops at the last.
function Rail({ first, last }) {
  return (
    <span
      className={`absolute left-1/2 w-px -translate-x-1/2 bg-ink-900/[0.09] dark:bg-white/[0.09] ${first ? "top-[1.15rem]" : "top-0"} ${
        last ? "h-[1.15rem]" : "bottom-0"
      } ${first && last ? "hidden" : ""}`}
      aria-hidden="true"
    />
  );
}

const ROW = "relative grid grid-cols-[3.25rem_0.75rem_minmax(0,1fr)] gap-x-2.5";

function TimelineItem({ event, day, now, first, last, onOpen }) {
  const status = eventStatus(event, now);
  const past = status.kind === "past";
  const live = status.kind === "live";
  const startsToday = sameDay(new Date(event.startTime), day);
  const range = `${timeLabel(event.startTime)} – ${timeLabel(event.endTime)}`;

  return (
    <li className={ROW}>
      <div className="pt-3 text-right">
        <p className={`text-xs font-semibold tabular-nums ${past ? "text-ink-400 dark:text-ink-500" : "text-ink-800 dark:text-ink-100"}`}>
          {startsToday ? shortTime(event.startTime) : "Cont."}
        </p>
        <p className="mt-0.5 text-[11px] text-ink-400 dark:text-ink-500">{durationLabel(eventMinutes(event))}</p>
      </div>

      <div className="relative flex justify-center">
        <Rail first={first} last={last} />
        <span
          className={`relative mt-[0.95rem] h-2.5 w-2.5 rounded-full ${
            past
              ? "border-2 border-ink-300 bg-white dark:border-ink-600 dark:bg-ink-900"
              : live
                ? "bg-brand-500 ring-4 ring-brand-500/20"
                : "brand-mark"
          }`}
          aria-hidden="true"
        />
      </div>

      <div
        className={`group relative mb-2.5 rounded-xl border p-3 transition-colors ${
          live
            ? "border-brand-500/45 bg-brand-500/[0.07] shadow-glow-sm dark:border-brand-400/35 dark:bg-brand-400/[0.08]"
            : "border-ink-900/[0.08] bg-white/60 hover:border-brand-400/50 hover:bg-white/90 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-brand-400/30 dark:hover:bg-white/[0.06]"
        }`}
      >
        <button
          type="button"
          onClick={() => onOpen(event)}
          aria-label={`Edit ${event.title}, ${range}`}
          className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
        <div className="pointer-events-none relative">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`min-w-0 break-words text-sm font-semibold leading-snug ${
                past ? "text-ink-500 dark:text-ink-400" : "text-ink-900 group-hover:text-brand-700 dark:text-ink-50 dark:group-hover:text-brand-200"
              }`}
            >
              {event.title}
            </p>
            <StatusTag status={status} />
          </div>
          <p className="mt-0.5 text-xs tabular-nums text-ink-500 dark:text-ink-400">{range}</p>
          {event.description && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-600 dark:text-ink-300">{event.description}</p>
          )}
          {(event.location || event.attendees?.length > 0) && (
            <div className="mt-2.5 flex min-w-0 items-center gap-3">
              {event.location && <Location location={event.location} status={status} />}
              <Attendees people={event.attendees} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function NowMarker({ now, first, last }) {
  return (
    <li className={`${ROW} items-center pb-2.5`} aria-label={`Now, ${timeLabel(now)}`}>
      <p className="text-right text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">Now</p>
      <div className="relative flex h-full justify-center self-stretch">
        <Rail first={first} last={last} />
        <span className="relative mt-[0.3rem] h-2 w-2 rounded-full bg-brand-500 ring-4 ring-brand-500/20" aria-hidden="true" />
      </div>
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="h-px flex-1 bg-gradient-to-r from-brand-500 to-transparent" />
        <span className="text-[11px] font-medium tabular-nums text-brand-600 dark:text-brand-300">{timeLabel(now)}</span>
      </div>
    </li>
  );
}

// The right-hand column: the selected day as a tear-off page (date, how
// booked it is, a 24-hour strip), then its events as a timeline with a "now"
// line threaded through when the day is today.
export default function DayPanel({ day, events, now, onCreate, onOpenEvent }) {
  const isToday = sameDay(day, now);
  const booked = bookedMinutes(events, day);
  const weekday = day.toLocaleDateString([], { weekday: "long" });

  // Where "now" falls among today's events: after the ones already underway
  // or over, before the ones still to come.
  const nowIndex = isToday ? events.filter((e) => new Date(e.startTime) <= now).length : -1;
  const rows = events.map((e) => ({ kind: "event", event: e }));
  if (nowIndex !== -1 && events.length) rows.splice(nowIndex, 0, { kind: "now" });

  return (
    <aside className="card flex flex-col p-3 xl:h-full xl:min-h-0" aria-label={`Schedule for ${weekday}`}>
      <div key={day.toDateString()} className="hero-panel rounded-2xl p-4 motion-safe:animate-fade-in">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white ring-1 ring-inset ring-white/20">
            {relativeDay(day, now)}
          </span>
          <span className="text-xs font-medium text-brand-100">
            {day.toLocaleDateString([], { month: "long", year: "numeric" })}
          </span>
        </div>
        <div className="mt-3 flex items-end gap-3">
          <span className="text-[3.5rem] font-semibold leading-[0.85] tracking-tight tabular-nums">{day.getDate()}</span>
          <div className="min-w-0 pb-0.5">
            <p className="text-base font-semibold leading-tight">{weekday}</p>
            <p className="mt-0.5 text-xs text-brand-100">
              {events.length
                ? `${events.length} event${events.length === 1 ? "" : "s"} · ${durationLabel(booked)} booked`
                : "Nothing scheduled"}
            </p>
          </div>
        </div>
        <DayStrip day={day} events={events} now={now} />
      </div>

      <div className="mt-4 px-1 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex h-full min-h-[10rem] flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300/70 px-6 py-8 text-center dark:border-white/10">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
              <CalendarPlus className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink-800 dark:text-ink-100">{weekday} is wide open</p>
            <p className="mt-1 max-w-[15rem] text-xs leading-relaxed text-ink-500 dark:text-ink-400">
              Double-click a day in the calendar, or pick a time in the week view, to add something.
            </p>
          </div>
        ) : (
          <ol key={day.toDateString()} className="motion-safe:animate-slide-fade-in">
            {rows.map((row, i) =>
              row.kind === "now" ? (
                <NowMarker key="now" now={now} first={i === 0} last={i === rows.length - 1} />
              ) : (
                <TimelineItem
                  key={row.event.id}
                  event={row.event}
                  day={day}
                  now={now}
                  first={i === 0}
                  last={i === rows.length - 1}
                  onOpen={onOpenEvent}
                />
              )
            )}
          </ol>
        )}
      </div>

      <button
        type="button"
        onClick={() => onCreate(day)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300/80 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:border-brand-500/60 hover:bg-brand-500/[0.06] hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-white/15 dark:text-ink-300 dark:hover:border-brand-400/40 dark:hover:text-brand-200"
      >
        <Plus className="h-4 w-4" />
        Add an event {isToday ? "today" : `on ${weekday}`}
      </button>
    </aside>
  );
}

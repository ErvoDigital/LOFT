import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Video } from "lucide-react";
import {
  MINUTES_IN_DAY,
  addDays,
  dayKey,
  eventsOnDay,
  layoutDay,
  meetingPath,
  minutesOfDay,
  sameDay,
  shortTime,
  timeLabel,
} from "./calendarDates.js";

const HOUR_PX = 52;
const SLOT_MINUTES = 30;
const GUTTER = "3.75rem";
const COLUMNS = { gridTemplateColumns: `${GUTTER} repeat(7, minmax(0, 1fr))` };
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const hourLabel = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });
const toPx = (minutes) => (minutes / 60) * HOUR_PX;

function zoneName(now) {
  try {
    return new Intl.DateTimeFormat([], { timeZoneName: "short" }).formatToParts(now).find((p) => p.type === "timeZoneName")
      ?.value;
  } catch {
    return null;
  }
}

function EventBlock({ item, now, onOpen }) {
  const { event, start, drawnEnd, col, cols } = item;
  const height = toPx(drawnEnd - start) - 2;
  const past = new Date(event.endTime) <= now;
  const live = !past && new Date(event.startTime) <= now;
  const compact = height < 40;
  const meeting = !!meetingPath(event.location);
  const range = `${timeLabel(event.startTime)} – ${timeLabel(event.endTime)}`;

  return (
    <button
      type="button"
      data-event
      onClick={(e) => {
        e.stopPropagation();
        onOpen(event);
      }}
      aria-label={`${event.title}, ${range}`}
      style={{
        top: toPx(start) + 1,
        height,
        left: `calc(${(col / cols) * 100}% + 3px)`,
        width: `calc(${100 / cols}% - 6px)`,
      }}
      className={`absolute z-[5] flex min-w-0 overflow-hidden rounded-lg border-l-[3px] px-2 text-left text-[11px] leading-tight shadow-soft transition-shadow hover:z-10 hover:shadow-glass focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        compact ? "items-center gap-1.5" : "flex-col gap-0.5 py-1.5"
      } ${
        past
          ? "border-ink-300 bg-ink-100 text-ink-500 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-400"
          : "border-brand-500 bg-brand-100 text-brand-900 dark:border-brand-400 dark:bg-brand-950 dark:text-brand-50"
      } ${live ? "shadow-glow-sm ring-1 ring-brand-500/50" : ""}`}
    >
      <span className="flex min-w-0 items-center gap-1 font-semibold">
        <span className="truncate">{event.title}</span>
        {meeting && <Video className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />}
      </span>
      <span className="truncate tabular-nums opacity-75">{compact ? shortTime(event.startTime) : range}</span>
    </button>
  );
}

function DayColumn({ day, items, isToday, now, ghost, setGhost, onCreate, onOpenEvent }) {
  const key = dayKey(day);
  const weekend = day.getDay() === 0 || day.getDay() === 6;

  function slotAt(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = ((e.clientY - rect.top) / HOUR_PX) * 60;
    return Math.min(MINUTES_IN_DAY - SLOT_MINUTES, Math.max(0, Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES));
  }

  const ghostHere = ghost?.key === key ? ghost.minutes : null;
  const ghostDate = ghostHere === null ? null : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, ghostHere);

  return (
    <div
      className={`relative cursor-pointer border-l border-ink-900/[0.07] dark:border-white/[0.07] ${
        isToday ? "bg-brand-500/[0.04] dark:bg-brand-400/[0.04]" : weekend ? "bg-ink-900/[0.018] dark:bg-white/[0.012]" : ""
      }`}
      onMouseMove={(e) => {
        if (e.target.closest("[data-event]")) return setGhost(null);
        const minutes = slotAt(e);
        if (ghost?.key !== key || ghost.minutes !== minutes) setGhost({ key, minutes });
      }}
      onMouseLeave={() => setGhost(null)}
      onClick={(e) => {
        if (e.target.closest("[data-event]")) return;
        const minutes = slotAt(e);
        onCreate(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes), true);
      }}
    >
      {ghostDate && (
        <div
          className="pointer-events-none absolute inset-x-1 flex items-center gap-1 rounded-lg border border-dashed border-brand-500/60 bg-brand-500/[0.07] px-2 text-[11px] font-medium text-brand-700 dark:border-brand-400/50 dark:text-brand-200"
          style={{ top: toPx(ghostHere) + 1, height: toPx(SLOT_MINUTES) - 2 }}
          aria-hidden="true"
        >
          <Plus className="h-3 w-3 shrink-0" />
          <span className="truncate tabular-nums">{shortTime(ghostDate)}</span>
        </div>
      )}

      {items.map((item) => (
        <EventBlock key={item.event.id} item={item} now={now} onOpen={onOpenEvent} />
      ))}

      {isToday && (
        <div className="pointer-events-none absolute inset-x-0 z-[6] -translate-y-1/2" style={{ top: toPx(minutesOfDay(now)) }} aria-hidden="true">
          <div className="relative h-0.5 bg-brand-500 shadow-[0_0_10px_rgb(var(--brand-500)/0.6)] dark:bg-brand-400">
            <span className="absolute -left-[5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-brand-500 ring-2 ring-white dark:bg-brand-400 dark:ring-ink-900" />
          </div>
        </div>
      )}
    </div>
  );
}

// Seven days against a 24-hour ruler. Events sit at their times, side by side
// where they overlap; clicking an empty half hour starts an event there.
export default function WeekView({ weekStart, events, selectedDate, now, onSelect, onCreate, onOpenEvent }) {
  const scrollRef = useRef(null);
  const [ghost, setGhost] = useState(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const laid = useMemo(() => days.map((d) => layoutDay(eventsOnDay(events, d), d)), [days, events]);
  const zone = useMemo(() => zoneName(new Date()), []);
  const todayIndex = days.findIndex((d) => sameDay(d, now));
  const nowTop = toPx(minutesOfDay(now));

  // Open on the part of the week worth seeing: a little before now if today
  // is in it, else an hour before its first event, else the working morning.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let minutes = 8 * 60;
    if (todayIndex !== -1) minutes = minutesOfDay(new Date()) - 90;
    else {
      const starts = laid.flat().map((item) => item.start);
      if (starts.length) minutes = Math.min(...starts) - 60;
    }
    el.scrollTop = toPx(Math.max(0, minutes));
  }, [dayKey(weekStart)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto overscroll-contain">
        <div className="min-w-[38rem]">
          <div
            className="sticky top-0 z-20 grid border-b border-ink-900/[0.07] bg-white/90 backdrop-blur-xl dark:border-white/[0.07] dark:bg-ink-900/90"
            style={COLUMNS}
          >
            <div className="flex items-end justify-end pb-2.5 pr-2.5 text-[10px] font-medium text-ink-400 dark:text-ink-500">
              {zone}
            </div>
            {days.map((d) => {
              const isToday = sameDay(d, now);
              const selected = sameDay(d, selectedDate);
              return (
                <button
                  key={dayKey(d)}
                  type="button"
                  onClick={() => onSelect(d)}
                  aria-pressed={selected}
                  aria-label={d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
                  className={`flex flex-col items-center gap-1 border-l border-ink-900/[0.07] py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:border-white/[0.07] ${
                    selected ? "bg-brand-500/[0.07] dark:bg-brand-400/[0.08]" : "hover:bg-ink-900/[0.03] dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
                      isToday ? "text-brand-600 dark:text-brand-300" : "text-ink-500 dark:text-ink-400"
                    }`}
                  >
                    {d.toLocaleDateString([], { weekday: "short" })}
                  </span>
                  <span
                    className={`flex h-8 min-w-8 items-center justify-center rounded-full px-1 text-base font-semibold tabular-nums ${
                      isToday
                        ? "brand-mark text-white shadow-glow-sm"
                        : selected
                          ? "text-brand-700 ring-1 ring-inset ring-brand-500/45 dark:text-brand-200"
                          : "text-ink-800 dark:text-ink-100"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative grid" style={{ ...COLUMNS, height: toPx(MINUTES_IN_DAY) }}>
            <div className="relative" aria-hidden="true">
              {HOURS.slice(1).map((h) => (
                <span
                  key={h}
                  className="absolute right-2.5 -translate-y-1/2 text-[10px] font-medium tabular-nums text-ink-400 dark:text-ink-500"
                  style={{ top: toPx(h * 60) }}
                >
                  {hourLabel(h)}
                </span>
              ))}
              {todayIndex !== -1 && (
                <span
                  className="brand-mark absolute right-1.5 z-10 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow-glow-sm"
                  style={{ top: nowTop }}
                >
                  {shortTime(now)}
                </span>
              )}
            </div>

            {/* Hour rules, and a faint line at the current time across the
                whole week so today's position reads from any column. */}
            <div className="pointer-events-none absolute inset-y-0 right-0" style={{ left: GUTTER }} aria-hidden="true">
              {HOURS.map((h) => (
                <div key={h} className="border-t border-ink-900/[0.06] dark:border-white/[0.05]" style={{ height: HOUR_PX }} />
              ))}
              {todayIndex !== -1 && (
                <div className="absolute inset-x-0 border-t border-dashed border-brand-500/35" style={{ top: nowTop }} />
              )}
            </div>

            {days.map((d, i) => (
              <DayColumn
                key={dayKey(d)}
                day={d}
                items={laid[i]}
                isToday={i === todayIndex}
                now={now}
                ghost={ghost}
                setGhost={setGhost}
                onCreate={onCreate}
                onOpenEvent={onOpenEvent}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

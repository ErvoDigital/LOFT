import { useEffect, useMemo, useRef } from "react";
import { Plus, Video } from "lucide-react";
import {
  addDays,
  bucketByDay,
  dayKey,
  meetingPath,
  monthWeeks,
  sameDay,
  shortTime,
  startOfMonth,
  withDayOfMonth,
} from "./calendarDates.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Past this many, a cell shows one fewer and a "+N more" line, so the count
// never pushes a pill out of the cell.
const MAX_PILLS = 3;

function EventPill({ event, day, now, onOpen }) {
  const past = new Date(event.endTime) <= now;
  const live = !past && new Date(event.startTime) <= now;
  const startsHere = sameDay(new Date(event.startTime), day);
  const meeting = !!meetingPath(event.location);

  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(event);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      title={`${event.title} · ${shortTime(event.startTime)}`}
      className={`flex w-full min-w-0 items-center gap-1.5 rounded-md py-[3px] pl-1 pr-1.5 text-left text-[11px] leading-tight transition-colors ${
        past
          ? "text-ink-500 hover:bg-ink-900/[0.05] dark:text-ink-500 dark:hover:bg-white/[0.05]"
          : "bg-brand-500/[0.09] text-brand-800 hover:bg-brand-500/[0.16] dark:bg-brand-400/[0.12] dark:text-brand-100 dark:hover:bg-brand-400/[0.2]"
      } ${live ? "ring-1 ring-inset ring-brand-500/60" : ""}`}
    >
      <span
        className={`h-3 w-[3px] shrink-0 rounded-full ${past ? "bg-ink-300 dark:bg-ink-600" : "bg-brand-500 dark:bg-brand-400"}`}
        aria-hidden="true"
      />
      {startsHere && <span className="shrink-0 tabular-nums opacity-75">{shortTime(event.startTime)}</span>}
      <span className="truncate font-medium">{event.title}</span>
      {meeting && <Video className="ml-auto h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />}
    </button>
  );
}

// The month as a ruled grid that fills its card. Arrow keys move the
// selected day (Page Up/Down a month, Home/End the week's ends) and Enter
// starts an event on it; a double click or the hover "+" does the same.
export default function MonthView({ monthDate, events, selectedDate, now, onSelect, onReveal, onCreate, onOpenEvent }) {
  const gridRef = useRef(null);
  const wantsFocus = useRef(false);
  const weeks = useMemo(() => monthWeeks(monthDate), [monthDate]);
  const gridStart = weeks[0][0];
  const gridEnd = addDays(weeks[weeks.length - 1][6], 1);
  const byDay = useMemo(() => {
    const last = weeks[weeks.length - 1][6];
    return bucketByDay(events, weeks[0][0], addDays(last, 1));
  }, [events, weeks]);
  const monthName = monthDate.toLocaleDateString([], { month: "long", year: "numeric" });

  useEffect(() => {
    if (!wantsFocus.current) return;
    wantsFocus.current = false;
    gridRef.current?.querySelector('[aria-selected="true"]')?.focus();
  }, [selectedDate, monthDate]);

  function onKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      if (e.target.getAttribute("role") !== "gridcell") return;
      e.preventDefault();
      onCreate(selectedDate);
      return;
    }
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    let target;
    if (step !== undefined) target = addDays(selectedDate, step);
    else if (e.key === "Home") target = addDays(selectedDate, -selectedDate.getDay());
    else if (e.key === "End") target = addDays(selectedDate, 6 - selectedDate.getDay());
    else if (e.key === "PageUp" || e.key === "PageDown") {
      const month = new Date(monthDate.getFullYear(), monthDate.getMonth() + (e.key === "PageUp" ? -1 : 1), 1);
      target = withDayOfMonth(month, selectedDate.getDate());
    } else return;
    e.preventDefault();
    wantsFocus.current = true;
    if (target >= gridStart && target < gridEnd && e.key !== "PageUp" && e.key !== "PageDown") onSelect(target);
    else onReveal(target);
  }

  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div
        ref={gridRef}
        role="grid"
        aria-label={monthName}
        aria-describedby="month-grid-help"
        onKeyDown={onKeyDown}
        className="flex min-h-0 flex-1 flex-col"
      >
        <p id="month-grid-help" className="sr-only">
          Arrow keys move between days, Page Up and Page Down change the month, and Enter adds an event on the
          selected day.
        </p>
        <div role="row" className="grid grid-cols-7 border-b border-ink-900/[0.07] dark:border-white/[0.07]">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              role="columnheader"
              className={`px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] sm:px-3 ${
                i === 0 || i === 6 ? "text-ink-400 dark:text-ink-500" : "text-ink-500 dark:text-ink-400"
              }`}
            >
              <span className="sm:hidden">{w.charAt(0)}</span>
              <span className="hidden sm:inline">{w}</span>
            </div>
          ))}
        </div>

        <div
          key={dayKey(startOfMonth(monthDate))}
          className="grid min-h-0 flex-1 motion-safe:animate-fade-in"
          style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(4.25rem, 1fr))` }}
        >
          {weeks.map((week) => (
            <div
              key={dayKey(week[0])}
              role="row"
              className="grid grid-cols-7 border-b border-ink-900/[0.07] last:border-b-0 dark:border-white/[0.07]"
            >
              {week.map((day) => (
                <DayCell
                  key={dayKey(day)}
                  day={day}
                  events={byDay.get(dayKey(day)) || []}
                  inMonth={day.getMonth() === monthDate.getMonth()}
                  isToday={sameDay(day, now)}
                  isSelected={sameDay(day, selectedDate)}
                  now={now}
                  onSelect={onSelect}
                  onCreate={onCreate}
                  onOpenEvent={onOpenEvent}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayCell({ day, events, inMonth, isToday, isSelected, now, onSelect, onCreate, onOpenEvent }) {
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  const shown = events.length > MAX_PILLS ? events.slice(0, MAX_PILLS - 1) : events;
  const hidden = events.length - shown.length;
  const fullDate = day.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const count = events.length ? `${events.length} event${events.length === 1 ? "" : "s"}` : "no events";

  return (
    <div
      role="gridcell"
      tabIndex={isSelected ? 0 : -1}
      aria-selected={isSelected}
      aria-current={isToday ? "date" : undefined}
      aria-label={`${fullDate}, ${count}`}
      onClick={() => onSelect(day)}
      onDoubleClick={() => onCreate(day)}
      className={`group relative flex min-w-0 cursor-pointer flex-col gap-1 border-r border-ink-900/[0.07] p-1 outline-none transition-colors last:border-r-0 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:border-white/[0.07] sm:p-1.5 ${
        isSelected
          ? "bg-brand-500/[0.07] dark:bg-brand-400/[0.08]"
          : weekend
            ? "bg-ink-900/[0.018] hover:bg-ink-900/[0.035] dark:bg-white/[0.012] dark:hover:bg-white/[0.035]"
            : "hover:bg-ink-900/[0.025] dark:hover:bg-white/[0.03]"
      }`}
    >
      {isSelected && (
        <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-brand-500/45 dark:ring-brand-400/40" aria-hidden="true" />
      )}

      <div className="flex items-center justify-between gap-1">
        <span
          className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums sm:h-7 sm:min-w-7 sm:text-[13px] ${
            isToday
              ? "brand-mark text-white shadow-glow-sm"
              : inMonth
                ? isSelected
                  ? "text-brand-700 dark:text-brand-200"
                  : "text-ink-800 dark:text-ink-100"
                : "text-ink-400/80 dark:text-ink-600"
          }`}
        >
          {day.getDate() === 1 && !isToday ? (
            <>
              <span className="mr-1 hidden font-medium sm:inline">{day.toLocaleDateString([], { month: "short" })}</span>1
            </>
          ) : (
            day.getDate()
          )}
        </span>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Add an event on ${fullDate}`}
          onClick={(e) => {
            e.stopPropagation();
            onCreate(day);
          }}
          className={`hidden h-6 w-6 items-center justify-center rounded-lg text-ink-500 transition-all hover:bg-brand-500/15 hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-200 sm:flex ${
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Phones get a dot per event; the cells are too narrow for titles. */}
      {events.length > 0 && (
        <div className="flex flex-wrap gap-[3px] px-1 sm:hidden" aria-hidden="true">
          {events.slice(0, 4).map((e) => (
            <span
              key={e.id}
              className={`h-1.5 w-1.5 rounded-full ${new Date(e.endTime) <= now ? "bg-ink-300 dark:bg-ink-600" : "bg-brand-500 dark:bg-brand-400"}`}
            />
          ))}
        </div>
      )}

      <div className={`hidden min-h-0 flex-1 flex-col gap-0.5 overflow-hidden sm:flex ${inMonth ? "" : "opacity-60"}`}>
        {shown.map((e) => (
          <EventPill key={e.id} event={e} day={day} now={now} onOpen={onOpenEvent} />
        ))}
        {hidden > 0 && (
          <span className="px-1.5 text-[11px] font-medium text-ink-500 dark:text-ink-400">+{hidden} more</span>
        )}
      </div>
    </div>
  );
}

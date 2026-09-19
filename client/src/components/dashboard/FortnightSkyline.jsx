import { useState } from "react";
import { dayDetails, dayName } from "./fortnight.js";

// Each meeting is one "floor" on its day, so a busy day stands taller in the
// skyline. Past this many the column stops growing and shows a count.
const MAX_FLOORS = 4;
const MAX_DEADLINE_MARKS = 4;

// The dashboard hero's two-week view. Meetings and deadlines differ by lane
// and shape (stacked blocks above the baseline, squares below the date), not
// by color alone, and a clash is an amber ring plus the word in the readout.
export default function FortnightSkyline({ days, selectedKey, onSelect }) {
  const [hoverKey, setHoverKey] = useState(null);
  const focused = days.find((d) => d.key === (hoverKey || selectedKey)) || days[0];

  return (
    <div className="rounded-2xl bg-ink-950/25 p-2.5 ring-1 ring-inset ring-white/10 sm:p-4">
      {/* Fourteen legible dates need ~24rem; narrower than that the strip
          scrolls sideways instead of crushing the numbers together. */}
      <div className="overflow-x-auto">
        <div className="relative min-w-[24rem]">
          <div
            role="group"
            aria-label="Your next 14 days"
            className="grid gap-x-0.5 sm:gap-x-1"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
            onMouseLeave={() => setHoverKey(null)}
          >
            {days.map((day) => {
              const selected = day.key === selectedKey;
              const isToday = day.index === 0;
              const weekend = day.date.getDay() === 0 || day.date.getDay() === 6;
              const monthStart = day.date.getDate() === 1 && !isToday;
              const floors = day.meetings.length;
              const fullDate = day.date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

              return (
                <button
                  key={day.key}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${fullDate}: ${dayDetails(day)}`}
                  onClick={() => onSelect(selected ? null : day.key)}
                  onMouseEnter={() => setHoverKey(day.key)}
                  onFocus={() => setHoverKey(day.key)}
                  onBlur={() => setHoverKey(null)}
                  className={`relative flex min-w-0 flex-col items-center rounded-xl pb-2 pt-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80 ${
                    selected ? "bg-white/[0.14] ring-1 ring-inset ring-white/30" : "hover:bg-white/[0.07]"
                  }`}
                >
                  {monthStart && (
                    <span className="absolute -left-px bottom-2 top-1 w-px bg-white/25 sm:-left-[3px]" aria-hidden="true" />
                  )}

                  <span className="flex h-16 w-full flex-col-reverse items-center gap-0.5" aria-hidden="true">
                    {Array.from({ length: Math.min(floors, MAX_FLOORS) }, (_, f) => (
                      <span
                        key={f}
                        className="h-3 w-2.5 origin-bottom rounded-[3px] bg-brand-300 shadow-[0_0_12px_-2px_rgb(var(--brand-300)/0.6)] motion-safe:animate-rise sm:w-3.5"
                        style={{ animationDelay: `${120 + day.index * 35 + f * 70}ms` }}
                      />
                    ))}
                    {floors > MAX_FLOORS && (
                      <span className="text-[10px] font-semibold leading-none text-white/85">+{floors - MAX_FLOORS}</span>
                    )}
                  </span>

                  <span
                    className={`mt-2 text-[10px] font-semibold uppercase leading-none tracking-wide ${
                      monthStart ? "text-brand-200" : weekend ? "text-white/45" : "text-white/65"
                    }`}
                    aria-hidden="true"
                  >
                    {monthStart
                      ? day.date.toLocaleDateString([], { month: "short" })
                      : day.date.toLocaleDateString([], { weekday: "narrow" })}
                  </span>
                  <span
                    className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums sm:h-7 sm:w-7 sm:text-[13px] ${
                      isToday ? "bg-white text-brand-800" : weekend ? "text-white/70" : "text-white"
                    } ${day.clash ? "ring-2 ring-accent-400" : ""}`}
                    aria-hidden="true"
                  >
                    {day.date.getDate()}
                  </span>

                  <span
                    className="mt-1.5 flex h-[17px] w-full flex-wrap content-start justify-center gap-[3px]"
                    aria-hidden="true"
                  >
                    {day.deadlines.length > MAX_DEADLINE_MARKS ? (
                      <span className="rounded-[3px] bg-white/85 px-1 text-[9px] font-bold leading-[13px] text-brand-900">
                        {day.deadlines.length}
                      </span>
                    ) : (
                      day.deadlines.map((t) => <span key={t.id} className="h-[7px] w-[7px] rounded-[2px] bg-white/85" />)
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {/* One continuous baseline under every column's floors: 0.25rem of
              top padding plus the 4rem floor area. */}
          <span className="pointer-events-none absolute inset-x-0 top-[4.25rem] h-px bg-white/20" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/10 px-1 pt-3 text-[11px] sm:px-0">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-white/70">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2 rounded-[2px] bg-brand-300" /> Meetings
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[7px] w-[7px] rounded-[2px] bg-white/85" /> Deadlines
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full ring-2 ring-inset ring-accent-400" /> Clash
          </span>
        </div>
        <p className="font-medium text-white/90" aria-live="polite">
          <span className="text-white">{dayName(focused)}</span>
          <span className="text-white/70"> · {dayDetails(focused)}</span>
        </p>
      </div>
    </div>
  );
}

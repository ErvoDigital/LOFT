import { displayColor } from "../../lib/colors.js";

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildGridDays(monthDate) {
  const first = startOfMonth(monthDate);
  const startWeekday = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startWeekday);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Phones mark a day with a dot per item, in its workspace's color, since a
// seventh of the screen is too narrow for titles. The selected day's list,
// shown beside or under the grid, carries the names.
const PHONE_DOTS = 3;

export default function MonthGrid({ monthDate, events, selectedDate, onSelectDate }) {
  const days = buildGridDays(monthDate);
  const today = new Date();

  const eventsByDay = new Map();
  for (const e of events) {
    const key = new Date(e.startTime).toDateString();
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key).push(e);
  }

  return (
    <div className="card p-2 sm:p-4">
      <div className="grid grid-cols-7 gap-0.5 pb-2 text-center text-xs font-semibold text-ink-400 sm:gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {days.map((d) => {
          const inMonth = d.getMonth() === monthDate.getMonth();
          const isToday = d.toDateString() === today.toDateString();
          const isSelected = selectedDate && d.toDateString() === selectedDate.toDateString();
          const dayEvents = eventsByDay.get(d.toDateString()) || [];

          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelectDate(d)}
              className={`flex h-12 flex-col items-center rounded-lg p-1 text-center transition-colors sm:h-20 sm:items-start sm:p-1.5 sm:text-left ${
                isSelected
                  ? "brand-mark text-white"
                  : inMonth
                  ? "hover:bg-ink-50 dark:text-ink-100 dark:hover:bg-ink-700"
                  : "text-ink-300 hover:bg-ink-50 dark:text-ink-600 dark:hover:bg-ink-700"
              }`}
            >
              <span
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-medium sm:h-5 sm:w-5 sm:text-xs ${
                  isToday && !isSelected ? "bg-accent-400 text-white" : ""
                }`}
              >
                {d.getDate()}
              </span>
              {dayEvents.length > 0 && (
                <span className="flex items-center justify-center gap-0.5 sm:hidden">
                  {dayEvents.slice(0, PHONE_DOTS).map((e) => (
                    <span
                      key={e.id}
                      className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : ""}`}
                      style={!isSelected ? { backgroundColor: displayColor(e.workspaceColor) } : {}}
                    />
                  ))}
                  <span className="sr-only">
                    {dayEvents.length} item{dayEvents.length === 1 ? "" : "s"}
                  </span>
                </span>
              )}
              <div className="hidden w-full flex-1 flex-col gap-0.5 overflow-hidden sm:flex">
                {dayEvents.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    className={`truncate rounded px-1 text-[10px] font-medium ${isSelected ? "bg-white/15 text-white" : "text-ink-600 dark:text-ink-200"}`}
                    style={!isSelected ? { backgroundColor: displayColor(e.workspaceColor) + "22" } : {}}
                  >
                    {e.title}
                  </span>
                ))}
                {dayEvents.length > 2 && (
                  <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-ink-400"}`}>+{dayEvents.length - 2} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
    <div className="card p-4">
      <div className="grid grid-cols-7 gap-1 pb-2 text-center text-xs font-semibold text-ink-400">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = d.getMonth() === monthDate.getMonth();
          const isToday = d.toDateString() === today.toDateString();
          const isSelected = selectedDate && d.toDateString() === selectedDate.toDateString();
          const dayEvents = eventsByDay.get(d.toDateString()) || [];

          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelectDate(d)}
              className={`flex h-20 flex-col items-start rounded-lg p-1.5 text-left transition-colors ${
                isSelected ? "brand-mark text-white" : inMonth ? "hover:bg-ink-50" : "text-ink-300 hover:bg-ink-50"
              }`}
            >
              <span
                className={`mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium ${
                  isToday && !isSelected ? "bg-accent-400 text-white" : ""
                }`}
              >
                {d.getDate()}
              </span>
              <div className="flex w-full flex-1 flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    className={`truncate rounded px-1 text-[10px] font-medium ${isSelected ? "bg-white/20 text-white" : "text-ink-600"}`}
                    style={!isSelected ? { backgroundColor: (e.workspaceColor || "#4F46E5") + "22" } : {}}
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

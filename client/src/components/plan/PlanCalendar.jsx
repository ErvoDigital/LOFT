import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import MonthGrid from "../calendar/MonthGrid.jsx";
import { TierBadge } from "../common/Badges.jsx";
import EmptyState from "../common/EmptyState.jsx";

function formatDuration(minutes) {
  const m = Number(minutes) || 0;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  if (rest === 0) return `${h}h`;
  return `${h}h ${rest}m`;
}

// The calendar lens on the same task list My Plan already ranks — reuses
// the per-workspace Calendar tab's MonthGrid, fed task due dates instead of
// events, so "what's due when" across every workspace has a month view
// right next to the day-by-day schedule instead of a separate page.
export default function PlanCalendar({ tasks, onTaskClick }) {
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const datedTasks = tasks.filter((t) => t.dueDate);
  const taskChips = datedTasks.map((t) => ({
    id: t.id,
    title: t.title,
    startTime: t.dueDate,
    workspaceColor: t.workspaceColor,
  }));

  const dayTasks = datedTasks
    .filter((t) => new Date(t.dueDate).toDateString() === selectedDate.toDateString())
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-ink-800">{monthDate.toLocaleDateString([], { month: "long", year: "numeric" })}</h4>
        <input
          type="month"
          className="input w-auto"
          value={`${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`}
          onChange={(e) => {
            const [year, month] = e.target.value.split("-").map(Number);
            if (year && month) setMonthDate(new Date(year, month - 1, 1));
          }}
        />
        <button className="btn-secondary" onClick={() => { setMonthDate(new Date()); setSelectedDate(new Date()); }}>
          Today
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <MonthGrid monthDate={monthDate} events={taskChips} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        <div className="card p-4">
          <h4 className="mb-3 text-sm font-semibold text-ink-700">
            {selectedDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </h4>
          {dayTasks.length === 0 ? (
            <EmptyState icon={<CalendarCheck className="h-5 w-5" />} title="Nothing due" description="No tasks due this day." />
          ) : (
            <div className="space-y-2">
              {dayTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onTaskClick(t)}
                  className="block w-full rounded-lg border border-ink-200 p-3 text-left hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-ink-700">{t.title}</p>
                    <TierBadge tier={t.tier} compact />
                  </div>
                  <p className="text-xs text-ink-400">
                    {t.workspaceName} · {formatDuration(t.estimatedMinutes)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

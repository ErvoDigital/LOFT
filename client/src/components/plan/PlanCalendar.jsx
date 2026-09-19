import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, Video, CalendarDays } from "lucide-react";
import MonthGrid from "../calendar/MonthGrid.jsx";
import { TierBadge } from "../common/Badges.jsx";
import EmptyState from "../common/EmptyState.jsx";
import { MonthPicker } from "../common/DatePicker.jsx";

function formatDuration(minutes) {
  const m = Number(minutes) || 0;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  if (rest === 0) return `${h}h`;
  return `${h}h ${rest}m`;
}

// True for an event whose location is a LOFT meeting link (what
// ScheduleMeetingModal fills in), vs. a plain calendar event/appointment.
function isMeetingEvent(event) {
  return typeof event.location === "string" && event.location.includes("/meeting");
}

// The calendar lens on the same task list My Plan already ranks — reuses
// the per-workspace Calendar tab's MonthGrid, fed both task due dates and
// upcoming events (including scheduled meetings) across every workspace, so
// "what's due and what's scheduled" has one month view next to the
// day-by-day schedule instead of a separate page.
export default function PlanCalendar({ tasks, events = [], onTaskClick }) {
  const navigate = useNavigate();
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const datedTasks = tasks.filter((t) => t.dueDate);
  const taskChips = datedTasks.map((t) => ({
    id: t.id,
    title: t.title,
    startTime: t.dueDate,
    workspaceColor: t.workspaceColor,
  }));
  const eventChips = events.map((e) => ({
    id: e.id,
    title: e.title,
    startTime: e.startTime,
    workspaceColor: e.workspaceColor,
  }));

  const dayTasks = datedTasks
    .filter((t) => new Date(t.dueDate).toDateString() === selectedDate.toDateString())
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const dayEvents = events
    .filter((e) => new Date(e.startTime).toDateString() === selectedDate.toDateString())
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-ink-800 dark:text-ink-100">
          <MonthPicker value={monthDate} onChange={setMonthDate} />
        </h4>
        <button className="btn-secondary" onClick={() => { setMonthDate(new Date()); setSelectedDate(new Date()); }}>
          Today
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <MonthGrid monthDate={monthDate} events={[...eventChips, ...taskChips]} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        <div className="card space-y-4 p-4">
          <div>
            <h4 className="mb-3 text-sm font-semibold text-ink-700 dark:text-ink-200">
              {selectedDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
            </h4>
            {dayEvents.length > 0 && (
              <div className="mb-3 space-y-2">
                {dayEvents.map((e) => {
                  const meeting = isMeetingEvent(e);
                  return (
                    <button
                      key={e.id}
                      onClick={() => navigate(`/workspaces/${e.workspaceId}/calendar`)}
                      className="block w-full rounded-lg border border-ink-200 p-3 text-left hover:border-brand-300 hover:bg-brand-50/40 dark:border-ink-600 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
                    >
                      <div className="flex items-start gap-2">
                        {meeting ? (
                          <Video className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                        ) : (
                          <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-700 dark:text-ink-100">{e.title}</p>
                          <p className="text-xs text-ink-400">
                            {new Date(e.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} ·{" "}
                            {e.workspaceName}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {dayTasks.length === 0 && dayEvents.length === 0 ? (
              <EmptyState icon={<CalendarCheck className="h-5 w-5" />} title="Nothing scheduled" description="No tasks or events for this day." />
            ) : dayTasks.length > 0 ? (
              <div className="space-y-2">
                {dayTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onTaskClick(t)}
                    className="block w-full rounded-lg border border-ink-200 p-3 text-left hover:border-brand-300 hover:bg-brand-50/40 dark:border-ink-600 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink-700 dark:text-ink-100">{t.title}</p>
                      <TierBadge tier={t.tier} compact />
                    </div>
                    <p className="text-xs text-ink-400">
                      {t.workspaceName} · {formatDuration(t.estimatedMinutes)}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

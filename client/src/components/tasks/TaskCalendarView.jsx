import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { monthWeeks } from "../calendar/calendarDates.js";
import { displayColor } from "../../lib/colors.js";
import { localDateKey, taskDueKey, sortTasks } from "../../lib/taskViews.js";
import { TaskTitle, TaskAssignee, TaskDue } from "./TaskRowFields.jsx";
import { TierBadge } from "../common/Badges.jsx";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TaskCalendarView({ tasks, statuses, onOpen }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(() => localDateKey());
  const [undatedOpen, setUndatedOpen] = useState(false);
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const sorted = sortTasks(tasks, { key: "priority" }, statuses);
  const byDate = new Map();
  for (const task of sorted) {
    const key = taskDueKey(task.dueDate);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(task);
  }
  const selectedTasks = byDate.get(undatedOpen ? "" : selectedDay) || [];
  const monthLabel = month.toLocaleDateString([], { month: "long", year: "numeric" });
  const dayLabel = (date) => date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const selectedDate = new Date(`${selectedDay}T12:00:00`);
  function moveMonth(amount) {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1);
    setMonth(next); setSelectedDay(localDateKey(next)); setUndatedOpen(false);
  }

  return <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-20" aria-label="Task calendar">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">{monthLabel}</h3>
        <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} className="btn-ghost !px-2 !py-1.5"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" aria-label="Next month" onClick={() => moveMonth(1)} className="btn-ghost !px-2 !py-1.5"><ChevronRight className="h-4 w-4" /></button>
        <button type="button" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDay(localDateKey(now)); setUndatedOpen(false); }} className="btn-secondary !px-2.5 !py-1 text-xs">Today</button>
      </div>
      <button type="button" aria-pressed={undatedOpen} onClick={() => setUndatedOpen((open) => !open)} className={`rounded-lg px-3 py-1.5 text-xs ${undatedOpen ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-700"}`}>No due date ({byDate.get("")?.length || 0})</button>
    </div>
    <div className="overflow-hidden rounded-xl border border-ink-200 bg-white/70 dark:border-white/10 dark:bg-ink-900/60">
      <div className="grid grid-cols-7 border-b border-ink-200 bg-ink-50/80 dark:border-white/10 dark:bg-white/[0.03]">{WEEKDAYS.map((day) => <span key={day} className="py-2 text-center text-[10px] font-medium text-ink-400 sm:text-xs">{day}</span>)}</div>
      <div className="grid grid-cols-7" aria-label={monthLabel}>
        {weeks.flat().map((date) => {
          const key = localDateKey(date), dayTasks = byDate.get(key) || [];
          const active = !undatedOpen && selectedDay === key, today = key === localDateKey();
          return <div key={key} className={`min-w-0 border-b border-r border-ink-200/70 p-1 dark:border-white/5 sm:p-2 ${date.getMonth() !== month.getMonth() ? "bg-ink-50/50 dark:bg-white/[0.02]" : ""} ${active ? "bg-brand-50/70 dark:bg-brand-500/10" : ""}`}>
            <button type="button" aria-label={`${dayLabel(date)}, ${dayTasks.length} ${dayTasks.length === 1 ? "task" : "tasks"}`} aria-pressed={active} onClick={() => { setSelectedDay(key); setUndatedOpen(false); }}
              className="flex min-h-[62px] w-full flex-col items-start rounded-lg p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:min-h-[104px]">
              <span className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums ${today ? "bg-brand-600 font-semibold text-white" : date.getMonth() !== month.getMonth() ? "text-ink-300 dark:text-ink-600" : "text-ink-600 dark:text-ink-300"}`}>{date.getDate()}</span>
              <span className="flex flex-wrap gap-1 sm:hidden">{dayTasks.slice(0, 3).map((task) => <span key={task.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: displayColor(statuses.find((status) => status.id === task.status)?.color) }} />)}</span>
              {dayTasks.length > 0 && <span className="mt-1 text-[9px] text-ink-400 sm:hidden">{dayTasks.length}</span>}
              <span className="hidden w-full space-y-1 sm:block">{dayTasks.slice(0, 2).map((task) => <span key={task.id} className="flex items-center gap-1 rounded bg-brand-500/[0.07] px-1 py-0.5 text-[10px] text-ink-600 dark:bg-brand-400/10 dark:text-ink-300">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: displayColor(statuses.find((status) => status.id === task.status)?.color) }} /><span className="truncate">{task.title}</span>
              </span>)}{dayTasks.length > 2 && <span className="block px-1 text-[10px] text-ink-400">+{dayTasks.length - 2} more</span>}</span>
            </button>
          </div>;
        })}
      </div>
    </div>
    <section className="mt-4 rounded-xl border border-ink-200 bg-white/70 p-4 dark:border-white/10 dark:bg-ink-900/60" aria-label="Tasks for selected day">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-700 dark:text-ink-200"><CalendarDays className="h-4 w-4 text-ink-400" />{undatedOpen ? "Tasks without a due date" : dayLabel(selectedDate)}<span className="text-xs font-normal text-ink-400">{selectedTasks.length}</span></h3>
      {!selectedTasks.length ? <p className="py-2 text-xs text-ink-400">{undatedOpen ? "All matching tasks have a due date." : "No matching tasks are due on this day."}</p> : <div className="divide-y divide-ink-200/70 dark:divide-white/5">
        {selectedTasks.map((task) => <div key={task.id} data-task-id={task.id} className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1 basis-52"><TaskTitle task={task} onOpen={onOpen} /></div>
          <TierBadge tier={task.tier} compact /><TaskDue task={task} statuses={statuses} /><TaskAssignee task={task} />
        </div>)}
      </div>}
    </section>
  </div>;
}

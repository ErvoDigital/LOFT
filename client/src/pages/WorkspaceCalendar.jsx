import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarX, Plus } from "lucide-react";
import * as eventsApi from "../api/events.js";
import * as workspacesApi from "../api/workspaces.js";
import { useSocket } from "../context/SocketContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { apiErrorMessage } from "../api/client.js";
import MonthView from "../components/calendar/MonthView.jsx";
import WeekView from "../components/calendar/WeekView.jsx";
import DayPanel from "../components/calendar/DayPanel.jsx";
import EventModal from "../components/calendar/EventModal.jsx";
import EventDetailsModal from "../components/calendar/EventDetailsModal.jsx";
import Spinner from "../components/common/Spinner.jsx";
import { MonthPicker } from "../components/common/DatePicker.jsx";
import {
  addDays,
  byStart,
  eventsOnDay,
  sameDay,
  shortTime,
  startOfDay,
  startOfMonth,
  startOfWeek,
  whenLabel,
  withDayOfMonth,
} from "../components/calendar/calendarDates.js";

const VIEW_KEY = "loft_calendar_view";

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === "week" ? "week" : "month";
  } catch {
    return "month";
  }
}

// The current time, re-read on each minute boundary so the "now" lines and
// live badges move with the clock.
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60000);
    }, 60000 - (Date.now() % 60000));
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);
  return now;
}

function Segmented({ label, children }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-xl border border-ink-200 bg-white/70 p-0.5 backdrop-blur-xl dark:border-white/[0.1] dark:bg-white/[0.06]"
    >
      {children}
    </div>
  );
}

function Segment({ active, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`rounded-[0.625rem] px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        active
          ? "bg-white text-ink-900 shadow-soft dark:bg-white/[0.14] dark:text-ink-50"
          : "text-ink-600 hover:bg-ink-900/[0.05] hover:text-ink-900 dark:text-ink-300 dark:hover:bg-white/[0.08] dark:hover:text-ink-50"
      } ${className}`}
      {...props}
    />
  );
}

function NextUp({ event, now, onReveal }) {
  const live = new Date(event.startTime) <= now;
  return (
    <button
      type="button"
      onClick={() => onReveal(new Date(event.startTime))}
      className="group inline-flex min-w-0 max-w-full items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75 motion-reduce:hidden" />}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
      </span>
      <span className="truncate">
        <span className="font-semibold text-ink-800 group-hover:text-brand-700 dark:text-ink-100 dark:group-hover:text-brand-200">
          {live ? "Happening now" : "Next up"}
        </span>{" "}
        <span className="group-hover:text-ink-800 dark:group-hover:text-ink-100">
          {event.title} · {live ? `until ${shortTime(event.endTime)}` : whenLabel(event.startTime, now)}
        </span>
      </span>
    </button>
  );
}

export default function WorkspaceCalendar() {
  const { workspaceId } = useParams();
  const { socket } = useSocket();
  const now = useNow();
  const [view, setView] = useState(readView);
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState("MEMBER");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [draftStart, setDraftStart] = useState(null);
  // The open event is tracked by id, not by value, so a live edit or
  // cancellation from someone else flows straight into the open card.
  const [detailsId, setDetailsId] = useState(null);
  const [error, setError] = useState("");
  const confirm = useConfirm();

  const load = useCallback(() => {
    Promise.all([eventsApi.listWorkspaceEvents(workspaceId), workspacesApi.getWorkspace(workspaceId)]).then(
      ([evts, workspace]) => {
        setEvents(evts);
        setMembers(workspace.members);
        setMyRole(workspace.myRole);
        setLoading(false);
      }
    );
  }, [workspaceId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => load();
    ["event:created", "event:updated", "event:cancelled"].forEach((e) => socket.on(e, handler));
    return () => ["event:created", "event:updated", "event:cancelled"].forEach((e) => socket.off(e, handler));
  }, [socket, load]);

  // Held steady across the clock's minute tick, so the week view isn't handed
  // a fresh set of day objects every time "now" moves.
  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const shownMonth = view === "week" ? startOfMonth(selectedDate) : monthDate;

  // Selecting a day keeps the month in place (a greyed day from the next
  // month stays where it was clicked); revealing one brings its month into view.
  const select = (day) => setSelectedDate(startOfDay(day));
  const reveal = (day) => {
    setSelectedDate(startOfDay(day));
    setMonthDate(startOfMonth(day));
  };

  function changeView(next) {
    setView(next);
    if (next === "month") setMonthDate(startOfMonth(selectedDate));
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Storage unavailable (private mode): the view just won't persist.
    }
  }

  function step(n) {
    if (view === "week") return reveal(addDays(selectedDate, 7 * n));
    const month = new Date(monthDate.getFullYear(), monthDate.getMonth() + n, 1);
    setMonthDate(month);
    setSelectedDate(withDayOfMonth(month, selectedDate.getDate()));
  }

  function pickMonth(month) {
    reveal(withDayOfMonth(month, selectedDate.getDate()));
  }

  // A new event on today starts at the next whole hour rather than a 9 AM
  // that may already be gone; other days, and the header button, use 9 AM.
  function create(day, exact = false) {
    let start = exact ? day : null;
    if (!exact && sameDay(day, now) && now.getHours() < 23) {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1);
    }
    select(day);
    setEditingEvent(null);
    setDraftStart(start);
    setModalOpen(true);
  }

  // Clicking an event anywhere in the calendar shows it first; editing is a
  // deliberate second step, and an admin-only one.
  function openEvent(event) {
    setError("");
    setDetailsId(event.id);
  }

  function editFromDetails() {
    setEditingEvent(detailsEvent);
    setDraftStart(null);
    setDetailsId(null);
    setModalOpen(true);
  }

  async function cancelFromDetails() {
    const ok = await confirm({
      title: "Cancel this event?",
      subject: detailsEvent.title,
      message: "It will be removed from the calendar for everyone invited. This can't be undone.",
      confirmLabel: "Cancel event",
      cancelLabel: "Keep event",
      icon: CalendarX,
    });
    if (!ok) return;
    try {
      await eventsApi.cancelEvent(workspaceId, detailsEvent.id);
      setEvents((prev) => prev.filter((e) => e.id !== detailsEvent.id));
      setDetailsId(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const detailsEvent = detailsId ? events.find((e) => e.id === detailsId) : null;
  const canManageEvents = myRole === "ADMIN";

  const [rangeStart, rangeEnd] =
    view === "week"
      ? [weekStart, addDays(weekStart, 7)]
      : [monthDate, new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1)];
  const inRange = events.filter((e) => new Date(e.startTime) < rangeEnd && new Date(e.endTime) > rangeStart).length;
  const rangeName =
    view === "week"
      ? now >= rangeStart && now < rangeEnd
        ? "this week"
        : `the week of ${weekStart.toLocaleDateString([], { month: "short", day: "numeric" })}`
      : monthDate.toLocaleDateString([], { month: "long" });
  const rangeSummary = inRange
    ? `${inRange} event${inRange === 1 ? "" : "s"} ${view === "week" && rangeName === "this week" ? "" : "in "}${rangeName}`
    : `Nothing scheduled ${view === "week" && rangeName === "this week" ? "" : "in "}${rangeName}`;
  const nextUp = events.filter((e) => new Date(e.endTime) > now).sort(byStart)[0];

  const prev = view === "week" ? addDays(weekStart, -7) : new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
  const next = view === "week" ? addDays(weekStart, 7) : new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
  const navLabel = (d) =>
    view === "week" ? d.toLocaleDateString([], { month: "short", day: "numeric" }) : d.toLocaleDateString([], { month: "short" });
  const navAria = (d, dir) =>
    view === "week"
      ? `${dir} week, starting ${d.toLocaleDateString([], { month: "long", day: "numeric" })}`
      : `${dir} month, ${d.toLocaleDateString([], { month: "long", year: "numeric" })}`;

  return (
    <div className="mx-auto flex max-w-[90rem] flex-col gap-5 p-4 sm:p-6 xl:h-full">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50 sm:text-[1.75rem]">
            <MonthPicker value={shownMonth} onChange={pickMonth} />
          </h1>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink-500 dark:text-ink-400">
            <span>{rangeSummary}</span>
            {nextUp && (
              <>
                <span className="text-ink-300 dark:text-ink-600" aria-hidden="true">
                  ·
                </span>
                <NextUp event={nextUp} now={now} onReveal={reveal} />
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmented label={view === "week" ? "Change week" : "Change month"}>
            <Segment onClick={() => step(-1)} aria-label={navAria(prev, "Previous")}>
              {navLabel(prev)}
            </Segment>
            <Segment onClick={() => reveal(now)} className="font-semibold">
              Today
            </Segment>
            <Segment onClick={() => step(1)} aria-label={navAria(next, "Next")}>
              {navLabel(next)}
            </Segment>
          </Segmented>
          <Segmented label="Calendar view">
            <Segment active={view === "month"} aria-pressed={view === "month"} onClick={() => changeView("month")}>
              Month
            </Segment>
            <Segment active={view === "week"} aria-pressed={view === "week"} onClick={() => changeView("week")}>
              Week
            </Segment>
          </Segmented>
          <button className="btn-primary" onClick={() => create(selectedDate)}>
            <Plus className="h-4 w-4" /> New event
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>
      )}

      {/* Explicit grid-cols-1: an implicit track grows to fit its widest
          content and pushes the week grid off-screen on phones. */}
      <div className="grid grid-cols-1 gap-5 xl:min-h-[38rem] xl:flex-1 xl:grid-cols-[minmax(0,1fr)_22rem] xl:grid-rows-[minmax(0,1fr)]">
        <div className={`min-w-0 ${view === "week" ? "h-[36rem] xl:h-auto" : ""}`}>
          {view === "month" ? (
            <MonthView
              monthDate={monthDate}
              events={events}
              selectedDate={selectedDate}
              now={now}
              onSelect={select}
              onReveal={reveal}
              onCreate={create}
              onOpenEvent={openEvent}
            />
          ) : (
            <WeekView
              weekStart={weekStart}
              events={events}
              selectedDate={selectedDate}
              now={now}
              onSelect={select}
              onCreate={create}
              onOpenEvent={openEvent}
            />
          )}
        </div>

        <DayPanel
          day={selectedDate}
          events={eventsOnDay(events, selectedDate)}
          now={now}
          onCreate={create}
          onOpenEvent={openEvent}
        />
      </div>

      <EventDetailsModal
        open={!!detailsEvent}
        onClose={() => setDetailsId(null)}
        event={detailsEvent}
        now={now}
        canManage={canManageEvents}
        createdByName={members.find((m) => m.user.id === detailsEvent?.createdById)?.user.name}
        onEdit={editFromDetails}
        onCancelEvent={cancelFromDetails}
      />

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        workspaceId={workspaceId}
        members={members}
        defaultDate={selectedDate}
        defaultStart={draftStart}
        event={editingEvent}
        onSaved={(saved) => {
          setEvents((prev) => {
            const exists = prev.some((e) => e.id === saved.id);
            return exists ? prev.map((e) => (e.id === saved.id ? saved : e)) : [...prev, saved];
          });
        }}
        onDeleted={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))}
      />
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, MapPin } from "lucide-react";
import * as eventsApi from "../api/events.js";
import * as workspacesApi from "../api/workspaces.js";
import { useSocket } from "../context/SocketContext.jsx";
import MonthGrid from "../components/calendar/MonthGrid.jsx";
import EventModal from "../components/calendar/EventModal.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Spinner from "../components/common/Spinner.jsx";

export default function WorkspaceCalendar() {
  const { workspaceId } = useParams();
  const { socket } = useSocket();
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const load = useCallback(() => {
    Promise.all([eventsApi.listWorkspaceEvents(workspaceId), workspacesApi.getWorkspace(workspaceId)]).then(
      ([evts, workspace]) => {
        setEvents(evts);
        setMembers(workspace.members);
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const dayEvents = events
    .filter((e) => new Date(e.startTime).toDateString() === selectedDate.toDateString())
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-ink-800">
            {monthDate.toLocaleDateString([], { month: "long", year: "numeric" })}
          </h2>
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
        <button
          className="btn-primary"
          onClick={() => {
            setEditingEvent(null);
            setModalOpen(true);
          }}
        >
          + New event
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <MonthGrid monthDate={monthDate} events={events} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink-700">
            {selectedDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </h3>
          {dayEvents.length === 0 ? (
            <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="No events" description="Nothing scheduled this day." />
          ) : (
            <div className="space-y-2">
              {dayEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setEditingEvent(e);
                    setModalOpen(true);
                  }}
                  className="block w-full rounded-lg border border-ink-200 p-3 text-left hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <p className="text-sm font-medium text-ink-700">{e.title}</p>
                  <p className="text-xs text-ink-400">
                    {new Date(e.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
                    {new Date(e.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                  {e.location && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-ink-400">
                      <MapPin className="h-3 w-3" /> {e.location}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        workspaceId={workspaceId}
        members={members}
        defaultDate={selectedDate}
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

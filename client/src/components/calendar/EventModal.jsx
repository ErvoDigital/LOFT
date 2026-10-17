import { useEffect, useState } from "react";
import { CalendarX } from "lucide-react";
import Modal from "../common/Modal.jsx";
import { useConfirm } from "../../context/ConfirmContext.jsx";
import * as eventsApi from "../../api/events.js";
import { apiErrorMessage } from "../../api/client.js";
import { DateTimePicker } from "../common/DatePicker.jsx";

function toLocalInput(date) {
  const d = date ? new Date(date) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// defaultStart, when given, is the exact start for a new event (a slot picked
// in the week view); otherwise a new event starts at 9 AM on defaultDate.
export default function EventModal({ open, onClose, workspaceId, members, defaultDate, defaultStart, event, draft, onSaved, onDeleted }) {
  const isEdit = !!event;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [attendeeIds, setAttendeeIds] = useState([]);
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [repeat, setRepeat] = useState("NONE"), [repeatCount, setRepeatCount] = useState(4);
  const [conflicts, setConflicts] = useState([]), [conflictError, setConflictError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (draft) {
      setTitle(draft.title);
      setDescription(draft.description || "");
      setLocation(draft.location || "");
      setStartTime(draft.startTime ? toLocalInput(draft.startTime) : "");
      setEndTime(draft.endTime ? toLocalInput(draft.endTime) : "");
      setAttendeeIds(draft.attendeeIds || []);
    } else if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setLocation(event.location || "");
      setStartTime(toLocalInput(event.startTime));
      setEndTime(toLocalInput(event.endTime));
      setAttendeeIds(event.attendees?.map((a) => a.id) || []);
    } else {
      const base = new Date(defaultStart || defaultDate || Date.now());
      if (!defaultStart) base.setHours(9, 0, 0, 0);
      const end = new Date(base.getTime() + 60 * 60 * 1000);
      setTitle("");
      setDescription("");
      setLocation("");
      setStartTime(toLocalInput(base));
      setEndTime(toLocalInput(end));
      setAttendeeIds(members.map((m) => m.user.id));
    }
    setError("");
    setRepeat("NONE"); setConflicts([]); setConflictError("");
  }, [open, event, draft, defaultDate, defaultStart, members]);

  useEffect(() => {
    if (!open || draft || !startTime || !endTime || new Date(endTime) <= new Date(startTime)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      Promise.resolve().then(() => eventsApi.previewConflicts(workspaceId, { startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString(), attendeeIds, ...(event ? { excludeEventId: event.id } : {}) }, controller.signal)).then((items) => { if (!controller.signal.aborted) { setConflicts(items); setConflictError(""); } }).catch(() => { if (!controller.signal.aborted) { setConflicts([]); setConflictError("Availability could not be checked. You can retry by adjusting the time."); } });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, workspaceId, startTime, endTime, attendeeIds, event, draft]);

  async function handleSubmit(e) {
    e.preventDefault();
    await save(false);
  }

  async function save(schedule) {
    setError("");
    if (!title.trim()) {
      setError("Add a title before saving.");
      return;
    }
    if (schedule && (!startTime || !endTime || !attendeeIds.length)) {
      setError("Add a start time, end time and at least one attendee before scheduling. You can save the draft with these details left open.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        title,
        description,
        location,
        startTime: startTime ? new Date(startTime).toISOString() : null,
        endTime: endTime ? new Date(endTime).toISOString() : null,
        attendeeIds,
        ...(!draft && !isEdit && repeat !== "NONE" ? { recurrence: { frequency: repeat, count: repeatCount, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } } : {}),
      };
      if ((!draft || schedule) && conflicts.length && !await confirm({ title: "Save despite scheduling conflicts?", message: `${conflicts.map((item) => item.name).join(", ")} already ${conflicts.length === 1 ? "has" : "have"} another commitment at this time.`, confirmLabel: "Save event", cancelLabel: "Change time" })) return;
      const saved = draft
        ? schedule ? await eventsApi.scheduleEventDraft(workspaceId, draft.id, payload) : await eventsApi.updateEventDraft(workspaceId, draft.id, payload)
        : isEdit ? await eventsApi.updateEvent(workspaceId, event.id, payload) : await eventsApi.createEvent(workspaceId, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: draft ? "Discard this meeting draft?" : "Cancel this event?",
      subject: (draft || event).title,
      message: draft ? "The unscheduled draft will be removed. This can't be undone." : "It will be removed from the calendar for everyone invited. This can't be undone.",
      confirmLabel: draft ? "Discard draft" : "Cancel event",
      cancelLabel: draft ? "Keep draft" : "Keep event",
      icon: CalendarX,
    });
    if (!ok) return;
    setLoading(true);
    try {
      if (draft) await eventsApi.deleteEventDraft(workspaceId, draft.id);
      else await eventsApi.cancelEvent(workspaceId, event.id);
      onDeleted((draft || event).id);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function toggleAttendee(id) {
    setAttendeeIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  return (
    <Modal open={open} onClose={onClose} title={draft ? "Finish meeting details" : isEdit ? "Edit event" : "New event"} width="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        {draft && <p className="text-sm text-ink-500 dark:text-ink-400">This meeting is a draft. Save any details now, then schedule it when the times and attendees are ready.</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="event-starts" className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">
              Starts
            </label>
            <DateTimePicker id="event-starts" value={startTime} onChange={setStartTime} required={!draft} />
          </div>
          <div>
            <label htmlFor="event-ends" className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">
              Ends
            </label>
            <DateTimePicker id="event-ends" value={endTime} onChange={setEndTime} align="end" required={!draft} />
          </div>
        </div>
        {!draft && !isEdit && <div className="flex items-end gap-3"><label className="flex-1 text-sm">Repeat<select className="input mt-1" value={repeat} onChange={(e) => setRepeat(e.target.value)}><option value="NONE">Does not repeat</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option></select></label>{repeat !== "NONE" && <label className="w-28 text-sm">Occurrences<input className="input mt-1" type="number" min="2" max="52" value={repeatCount} onChange={(e) => setRepeatCount(Number(e.target.value))} /></label>}</div>}
        {isEdit && event.seriesId && <p className="text-xs text-ink-500">Part of a recurring series. Changes apply to this occurrence.</p>}
        {conflicts.length > 0 && <p role="status" className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700">Scheduling conflict: {conflicts.map((item) => item.name).join(", ")} already {conflicts.length === 1 ? "has" : "have"} another commitment.</p>}
        {conflictError && <p role="status" className="text-xs text-ink-500">{conflictError}</p>}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Location (optional)</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room, link, or address" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Description (optional)</label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Attendees</label>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {members.map((m) => (
              <button
                type="button"
                key={m.user.id}
                onClick={() => toggleAttendee(m.user.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  attendeeIds.includes(m.user.id)
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    : "border-ink-200 text-ink-500 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-700"
                }`}
              >
                {m.user.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? "Saving…" : draft ? "Save draft" : isEdit ? "Save changes" : "Create event"}
          </button>
          {draft && <button type="button" className="btn-primary flex-1" disabled={loading} onClick={() => save(true)}>Schedule meeting</button>}
          {(isEdit || draft) && (
            <button type="button" onClick={handleDelete} disabled={loading} className="btn-danger">
              {draft ? "Discard draft" : "Cancel event"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

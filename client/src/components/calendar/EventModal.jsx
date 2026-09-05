import { useEffect, useState } from "react";
import Modal from "../common/Modal.jsx";
import * as eventsApi from "../../api/events.js";
import { apiErrorMessage } from "../../api/client.js";

function toLocalInput(date) {
  const d = date ? new Date(date) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventModal({ open, onClose, workspaceId, members, defaultDate, event, onSaved, onDeleted }) {
  const isEdit = !!event;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [attendeeIds, setAttendeeIds] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setLocation(event.location || "");
      setStartTime(toLocalInput(event.startTime));
      setEndTime(toLocalInput(event.endTime));
      setAttendeeIds(event.attendees?.map((a) => a.id) || []);
    } else {
      const base = defaultDate ? new Date(defaultDate) : new Date();
      base.setHours(9, 0, 0, 0);
      const end = new Date(base.getTime() + 60 * 60 * 1000);
      setTitle("");
      setDescription("");
      setLocation("");
      setStartTime(toLocalInput(base));
      setEndTime(toLocalInput(end));
      setAttendeeIds(members.map((m) => m.user.id));
    }
    setError("");
  }, [open, event, defaultDate, members]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        title,
        description,
        location,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        attendeeIds,
      };
      const saved = isEdit
        ? await eventsApi.updateEvent(workspaceId, event.id, payload)
        : await eventsApi.createEvent(workspaceId, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Cancel this event?")) return;
    setLoading(true);
    try {
      await eventsApi.cancelEvent(workspaceId, event.id);
      onDeleted(event.id);
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
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit event" : "New event"} width="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Starts</label>
            <input type="datetime-local" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Ends</label>
            <input type="datetime-local" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600">Location (optional)</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room, link, or address" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600">Description (optional)</label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600">Attendees</label>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {members.map((m) => (
              <button
                type="button"
                key={m.user.id}
                onClick={() => toggleAttendee(m.user.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  attendeeIds.includes(m.user.id) ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-500 hover:bg-ink-50"
                }`}
              >
                {m.user.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? "Saving…" : isEdit ? "Save changes" : "Create event"}
          </button>
          {isEdit && (
            <button type="button" onClick={handleDelete} disabled={loading} className="btn-danger">
              Cancel event
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

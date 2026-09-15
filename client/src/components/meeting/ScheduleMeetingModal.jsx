import { useEffect, useState } from "react";
import { Video } from "lucide-react";
import Modal from "../common/Modal.jsx";
import * as eventsApi from "../../api/events.js";
import { apiErrorMessage } from "../../api/client.js";

function toLocalInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Rounds up to the next half hour, so a freshly-opened modal doesn't default
// to a start time that's already in the past.
function nextHalfHour() {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 0, 0, 0);
  if (d.getMinutes() === 0) d.setHours(d.getHours() + 1);
  return d;
}

// Schedules a video call for this workspace by creating a regular calendar
// Event with its location pre-filled to the meeting link — reuses the
// existing Event flow entirely (events.controller.js already defaults
// attendees to every workspace member and notifies each of them, and My
// Plan already pulls upcoming events for its calendar view), so nothing
// meeting-specific needs to exist server-side.
export default function ScheduleMeetingModal({ open, onClose, workspaceId, meetLink }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = nextHalfHour();
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    setTitle("");
    setDescription("");
    setStartTime(toLocalInput(start));
    setEndTime(toLocalInput(end));
    setError("");
    setDone(false);
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await eventsApi.createEvent(workspaceId, {
        title,
        description,
        location: meetLink,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule a meeting" width="max-w-md">
      {done ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15 text-brand-600">
            <Video className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">Meeting scheduled</h2>
          <p className="mt-1 text-sm text-ink-400">
            It's on the workspace calendar, everyone's been notified, and it'll show up on their My Plan.
          </p>
          <button onClick={onClose} className="btn-primary mt-4 w-full">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly sync"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Starts</label>
              <input type="datetime-local" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Ends</label>
              <input type="datetime-local" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Description (optional)</label>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <p className="text-xs text-ink-400">
            Every workspace member will be invited, notified, and see this on their My Plan calendar. The meeting link is added
            automatically.
          </p>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Scheduling…" : "Schedule meeting"}
          </button>
        </form>
      )}
    </Modal>
  );
}

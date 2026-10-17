import { useState } from "react";
import * as eventsApi from "../../api/events.js";
import { apiErrorMessage } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function EventActions({ event, canManage, onSaved }) {
  const { user } = useAuth();
  const [slots, setSlots] = useState(null), [selected, setSelected] = useState(null), [preview, setPreview] = useState(false);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [response, setResponse] = useState(null);
  async function run(action) { setBusy(true); setError(""); try { await action(); } catch (err) { setError(apiErrorMessage(err)); } finally { setBusy(false); } }
  const attendance = event.attendees?.find((person) => person.id === user.id);
  return <div className="space-y-3 border-t border-ink-200 pt-4 dark:border-ink-700">
    {attendance && <div><p className="mb-2 text-xs text-ink-500">Your response: {(response || attendance.response || "PENDING").toLowerCase()}</p><div className="flex gap-2">{[["ACCEPTED", "Accept"], ["TENTATIVE", "Maybe"], ["DECLINED", "Decline"]].map(([value, label]) => <button type="button" key={value} className="btn-secondary !px-3 !py-1.5 !text-xs" disabled={busy} aria-pressed={(response || attendance.response) === value} onClick={() => run(async () => { await eventsApi.respondToEvent(event.workspaceId, event.id, value); setResponse(value); onSaved?.(); })}>{label}</button>)}</div></div>}
    {canManage && <button type="button" className="text-sm font-medium text-brand-600" disabled={busy} onClick={() => run(async () => { const result = await eventsApi.getAvailability(event.workspaceId, event.id); setSlots(result.slots); setSelected(null); setPreview(false); })}>Find a time that works for attendees</button>}
    {slots && <div className="space-y-2">{!slots.length && <p className="text-sm text-ink-500">No shared weekday slot was found between 9 AM and 6 PM over the next week.</p>}{slots.map((slot) => <label key={slot.startTime} className="flex items-center gap-2 text-sm"><input type="radio" name="alternative-slot" checked={selected === slot} onChange={() => { setSelected(slot); setPreview(false); }} />{new Date(slot.startTime).toLocaleString()} – {new Date(slot.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</label>)}
      {selected && !preview && <button type="button" className="btn-secondary" onClick={() => setPreview(true)}>Preview reschedule</button>}
      {selected && preview && <div className="rounded-lg bg-brand-500/10 p-3 text-sm"><p>Current: {new Date(event.startTime).toLocaleString()}</p><p>Proposed: {new Date(selected.startTime).toLocaleString()}</p><p className="mt-1 text-xs">This changes this occurrence for every attendee.</p><button type="button" className="btn-primary mt-3" disabled={busy} onClick={() => run(async () => { await eventsApi.updateEvent(event.workspaceId, event.id, selected); setSlots(null); onSaved?.(); })}>{busy ? "Saving…" : "Confirm reschedule"}</button></div>}
    </div>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>;
}

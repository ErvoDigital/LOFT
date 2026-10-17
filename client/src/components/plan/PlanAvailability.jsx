import { useState } from "react";
import * as planApi from "../../api/plan.js";
import { apiErrorMessage } from "../../api/client.js";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export default function PlanAvailability({ preferences, onSaved }) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(() => preferences?.hoursByWeekday || DAYS.map(() => preferences?.dailyCapacityHours || 6));
  const [meetings, setMeetings] = useState(preferences?.accountForMeetings || false);
  const [timeZone, setTimeZone] = useState(preferences?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(event) {
    event.preventDefault(); setSaving(true); setError("");
    try { await planApi.savePreferences({ hoursByWeekday: hours, accountForMeetings: meetings, timeZone }); await onSaved(); setOpen(false); }
    catch (err) { setError(apiErrorMessage(err)); } finally { setSaving(false); }
  }
  return <section className="card p-4">
    <button type="button" className="text-sm font-medium text-brand-600" aria-expanded={open} onClick={() => setOpen(!open)}>Working days and availability</button>
    {open && <form className="mt-4 space-y-4" onSubmit={save}>
      <p className="text-xs text-ink-500">Set a day to 0 hours to keep it free. These settings sync with your account.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{DAYS.map((day, index) => <label key={day} className="text-xs">{day}<input className="input mt-1" type="number" min="0" max="16" step="0.5" required value={hours[index]} onChange={(e) => setHours(hours.map((value, at) => at === index ? Number(e.target.value) : value))} /> hours</label>)}</div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={meetings} onChange={(e) => setMeetings(e.target.checked)} />Subtract meeting time from daily capacity</label>
      <label className="block text-sm">Time zone<input className="input mt-1" required value={timeZone} onChange={(e) => setTimeZone(e.target.value)} placeholder="Asia/Manila" /></label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save availability"}</button>
    </form>}
  </section>;
}

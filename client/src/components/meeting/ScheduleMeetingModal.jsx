import { useEffect, useRef, useState } from "react";
import { Check, Clock3, Video } from "lucide-react";
import Modal from "../common/Modal.jsx";
import * as eventsApi from "../../api/events.js";
import * as workspacesApi from "../../api/workspaces.js";
import { apiErrorMessage } from "../../api/client.js";
import { DateTimePicker } from "../common/DatePicker.jsx";
import { meetingDuration, nextMeetingSlot, toLocalMeetingInput, validateMeeting } from "../../lib/meetings.js";

export default function ScheduleMeetingModal({ open, onClose, workspaceId, meetLink, members: providedMembers, event, onSaved }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [members, setMembers] = useState([]);
  const [inviteAll, setInviteAll] = useState(true);
  const [attendeeIds, setAttendeeIds] = useState([]);
  const [memberError, setMemberError] = useState("");
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const scope = useRef(0), pending = useRef(false);

  useEffect(() => {
    const version = ++scope.current;
    pending.current = false; setLoading(false);
    if (!open) return;
    const start = event ? new Date(event.startTime) : nextMeetingSlot();
    setTitle(event?.title || ""); setDescription(event?.description || "");
    setStartTime(toLocalMeetingInput(start));
    setEndTime(toLocalMeetingInput(event?.endTime || new Date(start.getTime() + 30 * 60000)));
    setInviteAll(!event); setAttendeeIds(event?.attendees?.map((person) => person.id) || []);
    setError(""); setDone(false); setMemberError(""); setMembers(providedMembers || []);
    setMembersLoaded(!!providedMembers);
    if (!providedMembers) workspacesApi.getWorkspace(workspaceId).then((workspace) => {
      if (scope.current === version) { setMembers(workspace.members || []); setMembersLoaded(true); }
    }).catch(() => { if (scope.current === version) setMemberError("Couldn’t load members. You can still invite the whole workspace."); });
    return () => { scope.current++; };
  }, [open, workspaceId, event, providedMembers]);

  function changeStart(value) {
    const minutes = meetingDuration(startTime, endTime) || 30;
    setStartTime(value);
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) setEndTime(toLocalMeetingInput(new Date(date.getTime() + minutes * 60000)));
  }

  function setDuration(minutes) {
    const start = new Date(startTime);
    if (Number.isFinite(start.getTime())) setEndTime(toLocalMeetingInput(new Date(start.getTime() + minutes * 60000)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (pending.current) return;
    if (inviteAll && event && !membersLoaded) { setError("Wait for workspace members to load before inviting everyone."); return; }
    const validation = validateMeeting({ title, startTime, endTime, attendeeIds: inviteAll ? undefined : attendeeIds }, { editing: !!event });
    setError(validation);
    if (validation) return;
    const version = scope.current;
    pending.current = true; setLoading(true);
    try {
      const data = { title: title.trim(), description: description.trim(), location: meetLink, startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString(), ...(inviteAll ? (event ? { attendeeIds: members.map((member) => member.user.id) } : {}) : { attendeeIds }) };
      const saved = event ? await eventsApi.updateEvent(workspaceId, event.id, data) : await eventsApi.createEvent(workspaceId, data);
      if (version !== scope.current) return;
      setDone(true); onSaved?.(saved);
    } catch (err) { if (version === scope.current) setError(apiErrorMessage(err)); }
    finally { if (version === scope.current) { pending.current = false; setLoading(false); } }
  }

  const duration = meetingDuration(startTime, endTime);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const close = () => { if (!pending.current) onClose(); };
  return (
    <Modal open={open} onClose={close} title={event ? "Edit meeting" : "Schedule a meeting"} width="max-w-xl">
      {done ? (
        <div className="py-3 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400"><Check className="h-6 w-6" /></div>
          <h2 className="text-base font-semibold">{event ? "Meeting updated" : "Meeting scheduled"}</h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{title.trim()}</p>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">{new Date(startTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · {duration} min</p>
          <p className="mt-3 text-xs text-ink-400">Saved to the workspace calendar and attendees’ My Plan.{!event && " Invitations have been sent."}</p>
          <button onClick={onClose} className="btn-primary mt-5 w-full">Done</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}
          <fieldset disabled={loading} className="min-w-0 space-y-4">
            <div><label htmlFor="meeting-title" className="mb-1 block text-sm font-medium">Meeting title</label><input id="meeting-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly team sync" required maxLength={160} autoFocus /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="meeting-starts" className="mb-1 block text-sm font-medium">Starts</label><DateTimePicker id="meeting-starts" value={startTime} onChange={changeStart} disabled={loading} required /></div>
              <div><label htmlFor="meeting-ends" className="mb-1 block text-sm font-medium">Ends</label><DateTimePicker id="meeting-ends" value={endTime} onChange={setEndTime} disabled={loading} align="end" required /></div>
            </div>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Meeting duration">
              <Clock3 className="h-4 w-4 text-ink-400" />
              {[15, 30, 45, 60].map((minutes) => <button key={minutes} type="button" aria-pressed={duration === minutes} onClick={() => setDuration(minutes)} className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${duration === minutes ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300" : "border-ink-200 text-ink-500 dark:border-ink-700 dark:text-ink-400"}`}>{minutes} min</button>)}
            </div>
            <p className="text-xs text-ink-400">Times are shown in {timezone.replace(/_/g, " ")}.</p>
            <div><label htmlFor="meeting-agenda" className="mb-1 block text-sm font-medium">Agenda <span className="font-normal text-ink-400">(optional)</span></label><textarea id="meeting-agenda" className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="What will you discuss? Add topics or preparation notes." /></div>
            <div>
              <p className="mb-2 text-sm font-medium">Attendees</p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inviteAll} onChange={(e) => setInviteAll(e.target.checked)} disabled={!!memberError && !!event} className="accent-brand-500" /> Invite the whole workspace</label>
              {!inviteAll && <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-xl border border-ink-200 p-2 dark:border-ink-700">
                {members.length ? members.map(({ user: person }) => <label key={person.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-50 dark:hover:bg-ink-700"><input type="checkbox" className="accent-brand-500" checked={attendeeIds.includes(person.id)} onChange={() => setAttendeeIds((ids) => ids.includes(person.id) ? ids.filter((id) => id !== person.id) : [...ids, person.id])} />{person.name}</label>) : <p className="p-2 text-xs text-ink-400">{memberError || "Loading workspace members…"}</p>}
              </div>}
              {memberError && <p role="status" className="mt-2 text-xs text-amber-600">{memberError}</p>}
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-ink-50 p-3 text-xs text-ink-500 dark:bg-ink-900 dark:text-ink-400"><Video className="mt-0.5 h-4 w-4 shrink-0" /><p>This meeting uses the workspace room. The join link is included automatically; attendees need workspace access.</p></div>
          </fieldset>
          <div className="flex gap-2 pt-1"><button type="button" onClick={close} disabled={loading} className="btn-secondary">Cancel</button><button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? "Saving…" : event ? "Save changes" : "Schedule meeting"}</button></div>
        </form>
      )}
    </Modal>
  );
}

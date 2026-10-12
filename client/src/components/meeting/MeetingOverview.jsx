import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CalendarPlus, Clock3, Copy, Check, Video, Users, Search, ArrowUpRight } from "lucide-react";
import Modal from "../common/Modal.jsx";
import Avatar from "../common/Avatar.jsx";
import { downloadMeetingCalendar, meetingDuration } from "../../lib/meetings.js";

export default function MeetingOverview({ workspaceId, workspaceName, events, loading, loadError, onRetry, now, liveCount, connected, joining, error, meetLink, onJoin, onSchedule, onSettings, canManage, onEdit, onCancel, children }) {
  const [tab, setTab] = useState("upcoming"), [query, setQuery] = useState(""), [detailsId, setDetailsId] = useState(null);
  const [copied, setCopied] = useState(false), [copyError, setCopyError] = useState("");
  const upcoming = events.filter((event) => new Date(event.endTime) > now);
  const past = events.filter((event) => new Date(event.endTime) <= now).reverse();
  const shown = (tab === "upcoming" ? upcoming : past).filter((event) => `${event.title} ${event.description || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const details = events.find((event) => event.id === detailsId);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ");
  async function copyLink() {
    setCopyError("");
    try { await navigator.clipboard.writeText(meetLink); setCopied(true); }
    catch { setCopyError("Couldn’t copy the link. Select and copy it below."); }
  }
  return (
    <div className="h-full overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-28">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="section-label">{workspaceName}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Meetings</h1><p className="mt-1 text-sm text-ink-500 dark:text-ink-400">A place to meet, plan, and move work forward.</p></div>
          <button onClick={onSchedule} className="btn-primary"><CalendarPlus className="h-4 w-4" /> Schedule meeting</button>
        </header>
        <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <section aria-label="Workspace meeting room" className="relative overflow-hidden rounded-2xl bg-ink-900 p-5 text-white sm:p-7">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/10" aria-hidden="true" />
            <div className="relative">
              <div className="mb-5 flex items-center justify-between gap-2"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/20 text-brand-300"><Video className="h-5 w-5" /></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${liveCount > 0 ? "bg-brand-500/20 text-brand-300" : "bg-white/10 text-white/60"}`}>{liveCount > 0 ? "Live now" : "Ready when you are"}</span></div>
              <h2 className="text-xl font-semibold">{liveCount > 0 ? "Your team is meeting" : "Meet with your team"}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{liveCount > 0 ? `${liveCount} ${liveCount === 1 ? "person is" : "people are"} in the room. Join the conversation.` : "Start an instant call with your workspace. Check your camera and microphone before joining."}</p>
              {error && <p role="alert" className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
              {!connected && <p role="status" className="mt-3 text-xs text-amber-300">Reconnecting to the meeting service…</p>}
              <div className="mt-5 flex flex-wrap gap-2"><button onClick={onJoin} disabled={joining || !connected} className="btn-primary"><Video className="h-4 w-4" />{joining ? "Preparing…" : liveCount > 0 ? "Join meeting" : "Start meeting"}</button><button onClick={onSettings} className="btn-secondary !border-white/15 !bg-white/5 !text-white hover:!bg-white/10">Room details</button></div>
            </div>
          </section>
          <section aria-label="Meeting link" className="card flex flex-col justify-center p-5 sm:p-7">
            <p className="section-label">Your workspace room</p><h2 className="mt-2 text-lg font-semibold">One link for your team</h2><p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">Share this room with workspace members. Scheduled meetings use the same link.</p>
            <div className="mt-4 flex min-w-0 gap-2"><input aria-label="Workspace meeting link" readOnly value={meetLink} onFocus={(event) => event.target.select()} className="input min-w-0 flex-1 text-xs" /><button onClick={copyLink} className="btn-secondary shrink-0" aria-label="Copy meeting link">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button></div>
            {copied && <p role="status" className="mt-2 text-xs text-brand-600 dark:text-brand-300">Meeting link copied.</p>}{copyError && <p role="alert" className="mt-2 text-xs text-red-500">{copyError}</p>}
            <Link to={`/workspaces/${workspaceId}/calendar`} className="mt-4 inline-flex items-center gap-1.5 self-start text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">Open workspace calendar <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </section>
        </div>
        <section aria-label="Scheduled meetings" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-white/5" role="group" aria-label="Meeting schedule views">{[["upcoming", "Upcoming", upcoming.length], ["past", "Past", past.length]].map(([value, label, count]) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === value ? "bg-white text-ink-900 shadow-soft dark:bg-white/10 dark:text-white" : "text-ink-500 dark:text-ink-400"}`}>{label} <span className="ml-1 text-xs opacity-60">{count}</span></button>)}</div>
            <div className="relative min-w-0 flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" /><input aria-label="Search meetings" className="input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search meetings…" /></div>
          </div>
          <p className="text-xs text-ink-400">Times shown in {timezone}.{tab === "past" && " Past scheduled sessions are shown below."}</p>
          {loadError ? <div role="alert" className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><p className="text-red-500">{loadError}</p><button onClick={onRetry} className="btn-secondary">Retry</button></div> : loading ? <p role="status" className="py-8 text-center text-sm text-ink-400">Loading meetings…</p> : shown.length ? <div className="grid gap-3 md:grid-cols-2">{shown.map((event) => {
            const start = new Date(event.startTime), ongoing = start <= now && new Date(event.endTime) > now;
            return <article key={event.id} data-meeting-id={event.id} className="card flex gap-4 p-4 sm:p-5">
              <div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300"><span className="text-[10px] font-semibold uppercase">{start.toLocaleDateString([], { month: "short" })}</span><span className="text-2xl font-semibold leading-7">{start.getDate()}</span></div>
              <div className="min-w-0 flex-1"><button onClick={() => setDetailsId(event.id)} className="max-w-full text-left font-semibold hover:text-brand-600"><span className="line-clamp-2 break-words">{event.title}</span></button>{ongoing && <span className="ml-2 rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-600 dark:text-brand-300">Happening now</span>}
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-500 dark:text-ink-400"><Clock3 className="h-3 w-3" />{start.toLocaleDateString([], { weekday: "short", year: "numeric" })} · {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {meetingDuration(event.startTime, event.endTime)} min</p>
                {event.description && <p className="mt-2 line-clamp-2 break-words text-xs text-ink-500 dark:text-ink-400">{event.description}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-1 text-xs text-ink-400"><Users className="h-3.5 w-3.5" />{event.attendees?.length || 0} invited</span><button onClick={() => setDetailsId(event.id)} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">View details</button></div>
              </div>
            </article>;
          })}</div> : <div className="card border-dashed p-8 text-center"><CalendarDays className="mx-auto mb-3 h-8 w-8 text-ink-300 dark:text-ink-500" /><h3 className="text-sm font-medium">{query ? "No matching meetings" : tab === "upcoming" ? "No upcoming meetings" : "No past meetings"}</h3><p className="mt-1 text-xs text-ink-400">{query ? "Try another title or agenda topic." : tab === "upcoming" ? "Schedule a session so your team knows when to join." : "Your past scheduled sessions will appear here."}</p></div>}
        </section>
      </div>
      <Modal open={!!details} onClose={() => setDetailsId(null)} title="Meeting details" width="max-w-lg">
        {details && <div className="space-y-4"><h3 className="break-words text-xl font-semibold">{details.title}</h3><p className="text-sm text-ink-500 dark:text-ink-400">{new Date(details.startTime).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}<br />{meetingDuration(details.startTime, details.endTime)} minutes · {timezone}</p><div><h4 className="mb-1 text-sm font-medium">Agenda</h4><p className="whitespace-pre-wrap break-words text-sm text-ink-500 dark:text-ink-400">{details.description || "No agenda added yet."}</p></div><div><h4 className="mb-2 text-sm font-medium">Attendees ({details.attendees?.length || 0})</h4><div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">{details.attendees?.map((person) => <span key={person.id} className="flex items-center gap-1.5 rounded-full bg-ink-100 py-1 pl-1 pr-2.5 text-xs dark:bg-ink-700"><Avatar name={person.name} color={person.avatarColor} size={24} />{person.name}</span>)}</div></div><div className="flex flex-wrap gap-2"><button onClick={() => downloadMeetingCalendar(details)} className="btn-secondary"><CalendarPlus className="h-4 w-4" /> Add to calendar</button>{new Date(details.endTime) > now && <button onClick={onJoin} disabled={joining || !connected} className="btn-primary"><Video className="h-4 w-4" /> Open room</button>}</div>{canManage && <div className="flex gap-3 border-t border-ink-200 pt-4 dark:border-ink-700"><button onClick={() => { setDetailsId(null); onEdit(details); }} className="text-sm font-medium text-brand-600 dark:text-brand-300">Edit meeting</button><button onClick={() => { setDetailsId(null); onCancel(details); }} className="text-sm font-medium text-red-500">Cancel meeting</button></div>}</div>}
      </Modal>
      {children}
    </div>
  );
}

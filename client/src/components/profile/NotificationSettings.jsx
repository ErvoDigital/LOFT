import { useEffect, useState } from "react";
import * as notificationsApi from "../../api/notifications.js";
import { apiErrorMessage } from "../../api/client.js";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";

const TYPES = { TASK_ASSIGNED: "Task assignments", EVENT_REMINDER: "Events and meeting reminders", TASK_DUE_SOON: "Task deadline reminders", MENTION: "Mentions", MEETING_STARTED: "Meeting activity", WORKSPACE_INVITE: "Workspace invitations", NEW_MESSAGE: "Messages", FOLLOW_REQUEST: "Follow requests", FOLLOW_ACCEPTED: "Accepted follows" };
export default function NotificationSettings() {
  const [settings, setSettings] = useState(null), [error, setError] = useState(""), [saving, setSaving] = useState(false), [saved, setSaved] = useState(false);
  const { workspaces } = useWorkspaces();
  useEffect(() => { let current = true; notificationsApi.getPreferences().then((data) => { if (current) setSettings(data); }).catch((err) => { if (current) setError(apiErrorMessage(err)); }); return () => { current = false; }; }, []);
  const patch = (value) => { setSettings((current) => ({ ...current, ...value })); setSaved(false); };
  const toggle = (key, value) => patch({ [key]: settings[key].includes(value) ? settings[key].filter((item) => item !== value) : [...settings[key], value] });
  return <section className="card p-5 sm:p-6"><h2 className="font-semibold">Notifications</h2>
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    {settings && <form className="mt-4 space-y-5" onSubmit={async (event) => { event.preventDefault(); setSaving(true); setError(""); try { await notificationsApi.savePreferences(settings); setSaved(true); } catch (err) { setError(apiErrorMessage(err)); } finally { setSaving(false); } }}>
      <fieldset><legend className="mb-2 text-sm font-medium">Notify me about</legend><div className="grid gap-2 sm:grid-cols-2">{Object.entries(TYPES).map(([type, label]) => <label key={type} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!settings.disabledTypes.includes(type)} onChange={() => toggle("disabledTypes", type)} />{label}</label>)}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-medium">Muted workspaces</legend><div className="flex flex-wrap gap-3">{workspaces.map((workspace) => <label key={workspace.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.mutedWorkspaceIds.includes(workspace.id)} onChange={() => toggle("mutedWorkspaceIds", workspace.id)} />{workspace.name}</label>)}</div></fieldset>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Quiet hours</legend><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.quietHours.enabled} onChange={(event) => patch({ quietHours: { ...settings.quietHours, enabled: event.target.checked } })} />Keep updates in the inbox without popups</label><div className="flex flex-wrap items-center gap-2"><input aria-label="Quiet hours start" className="input !w-auto" type="time" value={settings.quietHours.start} onChange={(event) => patch({ quietHours: { ...settings.quietHours, start: event.target.value } })} /><span>to</span><input aria-label="Quiet hours end" className="input !w-auto" type="time" value={settings.quietHours.end} onChange={(event) => patch({ quietHours: { ...settings.quietHours, end: event.target.value } })} /><input aria-label="Notification time zone" className="input !w-44" value={settings.timeZone} onChange={(event) => patch({ timeZone: event.target.value })} /></div></fieldset>
      <div className="grid gap-3 sm:grid-cols-2">{[["eventReminderMinutes", "Meeting reminder"], ["taskReminderMinutes", "Task reminder"]].map(([key, label]) => <label key={key} className="text-sm">{label}<select className="input mt-1" value={settings[key]} onChange={(event) => patch({ [key]: Number(event.target.value) })}>{[[0, "Off"], [5, "5 minutes before"], [15, "15 minutes before"], [30, "30 minutes before"], [60, "1 hour before"], [1440, "1 day before"], [10080, "1 week before"]].map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}</div>
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save notification preferences"}</button>{saved && <span role="status" className="text-sm text-emerald-600">Saved to your account</span>}</div>
    </form>}
  </section>;
}

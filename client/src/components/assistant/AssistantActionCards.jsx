import { Link } from "react-router-dom";
import { priorityLabel } from "../../lib/priorities.js";

export default function AssistantActionCards({ actions = [], workspaces = [], userId, confirming, disabled, onConfirm, onDismiss }) {
  return actions.map((action) => (
    <section key={action.id} aria-label={`${action.kind === "task" ? "Task" : "Meeting"} confirmation`} className="min-w-0 rounded-xl border border-ink-200 bg-white p-3 text-left text-sm [overflow-wrap:anywhere] dark:border-ink-700 dark:bg-ink-800">
      <p className="font-semibold">{action.kind === "task" ? "Create task" : action.kind === "event_draft" ? "Save meeting draft" : "Create meeting"}: {action.data.title}</p>
      <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Workspace: {action.preview?.workspaceName || workspaces.find((w) => w.id === action.data.workspaceId)?.name || action.data.workspaceId}</p>
      {action.data.description && <p className="mt-1 whitespace-pre-wrap">{action.data.description}</p>}
      {action.data.location && <p className="mt-1 text-xs">Location: {action.data.location}</p>}
      {action.kind === "task" ? <>
        <p className="mt-1 text-xs">Priority: {priorityLabel(action.data.tier)}{action.data.deferredFields?.includes("tier") ? " (default until you edit it)" : ""} · {action.data.assigneeId ? `Assigned to ${action.data.assigneeId === userId ? "you" : action.preview?.people?.[0]?.name || action.data.assigneeId}` : "Unassigned"}</p>
        {action.data.dueDate && <p className="mt-1 text-xs">Due: {new Date(action.data.dueDate).toLocaleString()}</p>}
      </> : <>
        <p className="mt-1 text-xs">{action.kind === "event_draft" ? "Unscheduled draft — finish the details in your workspace calendar." : `${new Date(action.data.startTime).toLocaleString()} – ${new Date(action.data.endTime).toLocaleString()}`}</p>
        {action.kind === "event_draft" && action.data.startTime && <p className="mt-1 text-xs">Proposed start: {new Date(action.data.startTime).toLocaleString()}</p>}
        {action.kind === "event_draft" && action.data.endTime && <p className="mt-1 text-xs">Proposed end: {new Date(action.data.endTime).toLocaleString()}</p>}
        <p className="mt-1 text-xs">Attendees: {action.preview?.people?.map((person) => person.name).join(", ") || action.data.attendeeIds?.join(", ") || "To add later"}</p>
      </>}
      {action.data.deferredFields?.length > 0 && <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">You can add the remaining details later.</p>}
      {action.error && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{action.error}</p>}
      {action.result ? <>
        <p role="status" className="mt-2 font-medium text-brand-700 dark:text-brand-300">{action.kind === "task" ? "Task saved" : action.kind === "event_draft" ? "Meeting draft saved" : "Meeting saved"}</p>
        <Link className="mt-1 inline-block min-h-11 py-3 text-brand-600 underline dark:text-brand-400" to={`/workspaces/${action.result.workspaceId}/${action.kind === "task" ? "tasks" : "calendar"}`}>Saved — open {action.kind === "task" ? "task board" : "calendar"}</Link>
      </> : action.dismissed ? <p className="mt-2 text-xs">Dismissed</p> : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary min-h-11" onClick={() => onConfirm(action)} disabled={Boolean(confirming) || disabled}>{confirming === action.id ? "Saving…" : "Confirm"}</button>
          <button type="button" className="btn-secondary min-h-11" onClick={() => onDismiss(action.id)} disabled={Boolean(confirming) || disabled}>Dismiss</button>
        </div>
      )}
    </section>
  ));
}

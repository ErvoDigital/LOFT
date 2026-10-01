import { useEffect, useState } from "react";
import { Pin, Moon } from "lucide-react";
import Modal from "../common/Modal.jsx";
import { useConfirm } from "../../context/ConfirmContext.jsx";
import { PRIORITY_ORDER, TIER_META } from "../common/Badges.jsx";
import Select from "../common/Select.jsx";
import Avatar from "../common/Avatar.jsx";
import { displayColor } from "../../lib/colors.js";
import * as tasksApi from "../../api/tasks.js";
import { apiErrorMessage } from "../../api/client.js";
import { DatePicker } from "../common/DatePicker.jsx";

const DEFAULT_STATUSES = [
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
];

function StatusDot({ color }) {
  return <span className="h-2 w-2 rounded-full" style={{ backgroundColor: displayColor(color) }} />;
}

function formatDuration(minutes) {
  const m = Number(minutes) || 0;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  if (rest === 0) return `${h}h`;
  return `${h}h ${rest}m`;
}

// canChangeStatus: false locks the Status picker on an existing task — members
// can only move tasks assigned to them (the server enforces it; see
// tasks.controller.js's updateTask).
export default function TaskModal({
  open,
  onClose,
  workspaceId,
  members,
  statuses,
  task,
  canChangeStatus = true,
  onSaved,
  onDeleted,
}) {
  const STATUSES = statuses && statuses.length > 0 ? statuses : DEFAULT_STATUSES;
  const isEdit = !!task;
  const statusLocked = isEdit && !canChangeStatus;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tier, setTier] = useState("TIER_3");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [isPinned, setIsPinned] = useState(false);
  const [isSnoozed, setIsSnoozed] = useState(false);
  const [status, setStatus] = useState(STATUSES[0]?.value || "");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setTier(task.tier || "TIER_3");
      setEstimatedMinutes(task.estimatedMinutes ?? 30);
      setIsPinned(!!task.isPinned);
      setIsSnoozed(!!task.isSnoozed);
      setStatus(task.status);
      setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
      setAssigneeId(task.assignee?.id || "");
    } else {
      setTitle("");
      setDescription("");
      setTier("TIER_3");
      setEstimatedMinutes(30);
      setIsPinned(false);
      setIsSnoozed(false);
      setStatus(STATUSES[0]?.value || "");
      setDueDate("");
      setAssigneeId("");
    }
    setError("");
  }, [open, task]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        title,
        description,
        tier,
        estimatedMinutes: Number(estimatedMinutes) || 30,
        isPinned,
        isSnoozed,
        status,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        assigneeId: assigneeId || null,
      };
      const saved = isEdit
        ? await tasksApi.updateTask(workspaceId, task.id, payload)
        : await tasksApi.createTask(workspaceId, payload);
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
      title: "Delete this task?",
      subject: task.title,
      message: "It will be removed from the board for everyone in this workspace. This can't be undone.",
      confirmLabel: "Delete task",
    });
    if (!ok) return;
    setLoading(true);
    try {
      await tasksApi.deleteTask(workspaceId, task.id);
      onDeleted(task.id);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit task" : "New task"} width="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Description (optional)</label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <span id="task-priority" className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">
            Priority
          </span>
          {/* All four in view, lowest to highest, so picking one is a single tap. */}
          <div
            role="group"
            aria-labelledby="task-priority"
            className="grid grid-cols-4 gap-1 rounded-xl border border-ink-400/70 bg-ink-900/[0.03] p-1 dark:border-white/[0.1] dark:bg-white/[0.03]"
          >
            {PRIORITY_ORDER.map((t) => {
              const meta = TIER_META[t];
              const selected = tier === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTier(t)}
                  className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-1.5 py-1.5 text-sm font-medium transition-colors ${
                    selected
                      ? "bg-white text-ink-900 shadow-glass ring-1 ring-ink-900/[0.08] dark:bg-white/[0.12] dark:text-ink-50 dark:ring-white/[0.1]"
                      : "text-ink-500 hover:bg-ink-900/[0.05] hover:text-ink-800 dark:text-ink-400 dark:hover:bg-white/[0.06] dark:hover:text-ink-100"
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
                  <span className="truncate">{meta.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-ink-400">{TIER_META[tier].description}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="task-status" className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">
              Status
            </label>
            <Select
              id="task-status"
              value={status}
              onChange={setStatus}
              disabled={statusLocked}
              options={STATUSES.map((s) => ({
                value: s.value,
                label: s.label,
                icon: s.color ? <StatusDot color={s.color} /> : undefined,
              }))}
            />
            {statusLocked && <p className="mt-1 text-xs text-ink-400">Only its assignee, or someone given access, can change this.</p>}
          </div>
          <div>
            <label htmlFor="task-due" className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">
              Due date (optional)
            </label>
            <DatePicker id="task-due" value={dueDate} onChange={setDueDate} placeholder="No due date" align="end" clearable />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Estimated duration (minutes)</label>
            <input
              type="number"
              min={5}
              max={1440}
              step={5}
              className="input"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-400">≈ {formatDuration(estimatedMinutes)} — fed into My Plan's daily schedule</p>
          </div>
          <div>
            <label htmlFor="task-assignee" className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">
              Assignee
            </label>
            <Select
              id="task-assignee"
              value={assigneeId}
              onChange={setAssigneeId}
              options={[
                {
                  value: "",
                  label: "Unassigned",
                  icon: <span className="h-5 w-5 rounded-full border border-dashed border-ink-400 dark:border-ink-500" />,
                },
                ...members.map((m) => ({
                  value: m.user.id,
                  label: m.user.name,
                  icon: <Avatar name={m.user.name} color={m.user.avatarColor} src={m.user.avatarUrl} size={20} />,
                })),
              ]}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Overrides</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsPinned((p) => !p)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isPinned
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  : "border-ink-200 text-ink-500 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-700"
              }`}
            >
              <Pin className="h-3.5 w-3.5" /> Pin to top
            </button>
            <button
              type="button"
              onClick={() => setIsSnoozed((s) => !s)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isSnoozed
                  ? "border-ink-400 bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-300"
                  : "border-ink-200 text-ink-500 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-700"
              }`}
            >
              <Moon className="h-3.5 w-3.5" /> Snooze
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? "Saving…" : isEdit ? "Save changes" : "Create task"}
          </button>
          {isEdit && (
            <button type="button" onClick={handleDelete} disabled={loading} className="btn-danger">
              Delete
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

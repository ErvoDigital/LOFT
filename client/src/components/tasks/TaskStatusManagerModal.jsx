import { useEffect, useState } from "react";
import { GripVertical, Check } from "lucide-react";
import Modal from "../common/Modal.jsx";
import * as taskStatusesApi from "../../api/taskStatuses.js";
import { apiErrorMessage } from "../../api/client.js";

const COLORS = ["#8a8578", "#C17538", "#4F6B8C", "#8C5A9C", "#B8562F", "#4A8C7A", "#3D8BFD", "#C44569"];

export default function TaskStatusManagerModal({ open, onClose, workspaceId, statuses, onChanged }) {
  const [local, setLocal] = useState(statuses);
  const [dragIndex, setDragIndex] = useState(null);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocal(statuses);
  }, [statuses]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!label.trim()) return;
    setError("");
    setLoading(true);
    try {
      const status = await taskStatusesApi.createTaskStatus(workspaceId, { label: label.trim(), color });
      const next = [...local, status];
      setLocal(next);
      onChanged(next);
      setLabel("");
      setColor(COLORS[0]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRename(status, newLabel) {
    if (!newLabel.trim() || newLabel === status.label) return;
    try {
      const updated = await taskStatusesApi.updateTaskStatus(workspaceId, status.id, { label: newLabel.trim() });
      const next = local.map((s) => (s.id === updated.id ? updated : s));
      setLocal(next);
      onChanged(next);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleRecolor(status, newColor) {
    try {
      const updated = await taskStatusesApi.updateTaskStatus(workspaceId, status.id, { color: newColor });
      const next = local.map((s) => (s.id === updated.id ? updated : s));
      setLocal(next);
      onChanged(next);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleMarkDone(status) {
    setError("");
    try {
      const updated = await taskStatusesApi.updateTaskStatus(workspaceId, status.id, { isDone: true });
      const next = local.map((s) => (s.id === updated.id ? updated : { ...s, isDone: false }));
      setLocal(next);
      onChanged(next);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleDelete(status) {
    if (!confirm(`Delete the "${status.label}" status?`)) return;
    setError("");
    try {
      await taskStatusesApi.deleteTaskStatus(workspaceId, status.id);
      const next = local.filter((s) => s.id !== status.id);
      setLocal(next);
      onChanged(next);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setLocal((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(index);
  }

  async function handleDrop() {
    setDragIndex(null);
    setError("");
    try {
      const updated = await Promise.all(
        local.map((s, i) => taskStatusesApi.updateTaskStatus(workspaceId, s.id, { order: i }))
      );
      const next = updated.sort((a, b) => a.order - b.order);
      setLocal(next);
      onChanged(next);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Customize statuses" width="max-w-lg">
      <p className="mb-3 text-sm text-ink-400">
        Drag to reorder your board's columns. Rename them, recolor them, or add new ones — mark whichever one
        means "done" so overdue and reminder checks know to skip it.
      </p>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="mb-4 space-y-1.5">
        {local.map((s, i) => (
          <div
            key={s.id}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={handleDrop}
            className={`flex items-center gap-2 rounded-lg border border-ink-100 px-2 py-1.5 ${
              dragIndex === i ? "opacity-40" : ""
            }`}
          >
            <span
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragEnd={() => setDragIndex(null)}
              className="cursor-grab select-none text-ink-300 active:cursor-grabbing"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <input
              className="min-w-0 flex-1 rounded-md border-none bg-transparent px-1 py-0.5 text-sm text-ink-700 focus:bg-ink-50 focus:outline-none"
              defaultValue={s.label}
              onBlur={(e) => handleRename(s, e.target.value)}
            />
            <input
              type="color"
              value={s.color}
              onChange={(e) => handleRecolor(s, e.target.value)}
              className="h-6 w-6 shrink-0 cursor-pointer rounded border-none bg-transparent p-0"
              title="Color"
            />
            <button
              type="button"
              onClick={() => handleMarkDone(s)}
              disabled={s.isDone}
              className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                s.isDone ? "bg-brand-100 text-brand-700" : "text-ink-300 hover:bg-ink-100 hover:text-ink-500"
              }`}
              title={s.isDone ? "This status means done" : "Mark as the done status"}
            >
              {s.isDone ? (
                <>
                  <Check className="h-3 w-3" /> Done
                </>
              ) : (
                "Mark done"
              )}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(s)}
              disabled={local.length <= 1}
              className="shrink-0 rounded p-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-30"
              title={local.length <= 1 ? "A workspace needs at least one status" : "Delete"}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="space-y-2 border-t border-ink-100 pt-3">
        <label className="block text-sm font-medium text-ink-600">Add a status</label>
        <div className="flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="e.g. Under review"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
          />
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`h-6 w-6 rounded-full ${color === c ? "ring-2 ring-ink-800 ring-offset-1" : ""}`}
              />
            ))}
          </div>
          <button type="submit" disabled={loading || !label.trim()} className="btn-primary shrink-0">
            {loading ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

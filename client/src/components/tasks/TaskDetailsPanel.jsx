import { useEffect, useRef, useState } from "react";
import { X, Pencil, Maximize2, Minimize2, Pin, Moon, Calendar, Clock3, Paperclip, File, Image, Film, Music, FileText, Trash2, Loader2, Download } from "lucide-react";
import Avatar from "../common/Avatar.jsx";
import { TierBadge } from "../common/Badges.jsx";
import PreviewModal from "../storage/PreviewModal.jsx";
import * as assetsApi from "../../api/assets.js";
import { apiErrorMessage } from "../../api/client.js";

function formatDuration(minutes) {
  const m = Number(minutes) || 0;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  if (rest === 0) return `${h}h`;
  return `${h}h ${rest}m`;
}

function formatDateTime(value) {
  if (!value) return null;
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function FileIcon({ mimeType, className }) {
  if (!mimeType) return <File className={className} />;
  if (mimeType.startsWith("video/")) return <Film className={className} />;
  if (mimeType.startsWith("image/")) return <Image className={className} />;
  if (mimeType.startsWith("audio/")) return <Music className={className} />;
  if (DOCUMENT_MIME_TYPES.has(mimeType)) return <FileText className={className} />;
  return <File className={className} />;
}

export default function TaskDetailsPanel({ open, task, workspaceId, statuses, onClose, onEdit }) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState("");
  const [previewing, setPreviewing] = useState(null);
  const fileInputRef = useRef(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(raf);
    }
    setShow(false);
    const timer = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  useEffect(() => {
    if (!open || !task) return;
    const id = ++requestId.current;
    setAttachmentsLoading(true);
    setAttachmentsError("");
    assetsApi
      .listTaskAttachments(workspaceId, task.id)
      .then((assets) => {
        if (id === requestId.current) setAttachments(assets);
      })
      .catch((err) => {
        if (id === requestId.current) setAttachmentsError(apiErrorMessage(err));
      })
      .finally(() => {
        if (id === requestId.current) setAttachmentsLoading(false);
      });
  }, [open, task, workspaceId]);

  if (!mounted || !task) return null;

  const overdue = task.dueDate && new Date(task.dueDate) < new Date();
  const statusMeta = statuses?.find((s) => s.id === task.status);

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setAttachmentsError("");
    try {
      for (const file of files) {
        const asset = await assetsApi.uploadTaskAttachment(workspaceId, task.id, file);
        setAttachments((prev) => [...prev, asset]);
      }
    } catch (err) {
      setAttachmentsError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAttachment(asset) {
    try {
      await assetsApi.deleteTaskAttachment(workspaceId, task.id, asset.id);
      setAttachments((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (err) {
      setAttachmentsError(apiErrorMessage(err));
    }
  }

  function handleDownload(asset) {
    if (asset.latestVersion) assetsApi.downloadVersion(workspaceId, asset.id, asset.latestVersion);
  }

  return (
    <div className="absolute inset-0 z-40">
      <div
        className={`absolute inset-0 bg-ink-900/50 transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-panel transition-all duration-300 ease-out ${
          expanded ? "max-w-full" : "max-w-sm md:max-w-md"
        } ${show ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Task details</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              title={expanded ? "Collapse" : "Expand"}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onEdit}
              title="Edit task"
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto py-5 ${expanded ? "px-10" : "px-5"}`}>
          <div className={`space-y-5 ${expanded ? "mx-auto w-full max-w-6xl" : ""}`}>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {task.isPinned && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                    <Pin className="h-3 w-3" /> Pinned
                  </span>
                )}
                {task.isSnoozed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500">
                    <Moon className="h-3 w-3" /> Snoozed
                  </span>
                )}
                <TierBadge tier={task.tier} />
              </div>
              <h3 className="text-lg font-semibold text-ink-900">{task.title}</h3>
            </div>

            <div className={`grid gap-4 ${expanded ? "grid-cols-4" : "grid-cols-2"}`}>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Status</p>
                {statusMeta ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: statusMeta.color }} />
                    {statusMeta.label}
                  </span>
                ) : (
                  <span className="text-sm text-ink-500">{task.status}</span>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Duration</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700">
                  <Clock3 className="h-3.5 w-3.5 text-ink-400" />
                  {formatDuration(task.estimatedMinutes)}
                </span>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Due date</p>
                {task.dueDate ? (
                  <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${overdue ? "text-red-500" : "text-ink-700"}`}>
                    <Calendar className="h-3.5 w-3.5" />
                    {overdue ? "Overdue · " : ""}
                    {new Date(task.dueDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                ) : (
                  <span className="text-sm text-ink-300">No due date</span>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Assignee</p>
                {task.assignee ? (
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-700">
                    <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size={20} />
                    {task.assignee.name}
                  </span>
                ) : (
                  <span className="text-sm text-ink-300">Unassigned</span>
                )}
              </div>
            </div>

            {task.description && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Description</p>
                <p className="whitespace-pre-wrap text-sm text-ink-600">{task.description}</p>
              </div>
            )}

            <div className="border-t border-ink-100 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Attach files</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                  {uploading ? "Uploading…" : "Add file"}
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFilesSelected} />
              </div>

              {attachmentsError && <p className="mb-2 text-xs text-red-500">{attachmentsError}</p>}

              {attachmentsLoading ? (
                <p className="text-sm text-ink-300">Loading attachments…</p>
              ) : attachments.length === 0 ? (
                <p className="text-sm text-ink-300">No files attached yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {attachments.map((asset) => (
                    <li
                      key={asset.id}
                      className="group flex items-center gap-2.5 rounded-lg border border-ink-100 px-2.5 py-2 hover:bg-ink-50"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                        <FileIcon mimeType={asset.latestVersion?.mimeType} className="h-4 w-4" />
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownload(asset)}
                        className="min-w-0 flex-1 text-left"
                        title="Download"
                      >
                        <p className="truncate text-sm font-medium text-ink-800 hover:text-brand-600">{asset.name}</p>
                        {asset.latestVersion && <p className="text-xs text-ink-400">{formatSize(asset.latestVersion.size)}</p>}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(asset)}
                        title="Remove"
                        className="shrink-0 rounded-md p-1 text-ink-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 focus:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {(task.createdAt || task.updatedAt) && (
              <div className="border-t border-ink-100 pt-4 text-xs text-ink-400">
                {task.createdAt && <p>Created {formatDateTime(task.createdAt)}</p>}
                {task.updatedAt && <p>Last updated {formatDateTime(task.updatedAt)}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

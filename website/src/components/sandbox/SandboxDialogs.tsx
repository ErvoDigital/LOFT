import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, FileText, Plus, X } from "lucide-react";
import {
  MEMBERS,
  PRIORITIES,
  STATUSES,
  formatTime,
  uid,
  workspaceFor,
} from "./model";
import type {
  Asset,
  CalendarEvent,
  Priority,
  SandboxData,
  Status,
  Task,
  WorkspaceId,
} from "./model";
import { WorkspaceTag } from "./SandboxViews";

export type SandboxDialog =
  | { type: "task"; taskId?: string }
  | { type: "event"; eventId?: string; day?: string }
  | { type: "asset"; assetId: string }
  | { type: "notifications" };

export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="ls-dialog"
      aria-labelledby="ls-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="ls-dialog-heading">
        <h2 id="ls-dialog-title">{title}</h2>
        <button
          type="button"
          className="ls-icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="ls-dialog-body">{children}</div>
    </dialog>
  );
}

export function TaskForm({
  task,
  workspaceId,
  today,
  onSave,
  onClose,
}: {
  task?: Task;
  workspaceId: WorkspaceId;
  today: string;
  onSave: (task: Task) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [status, setStatus] = useState<Status>(task?.status || "TODO");
  const [priority, setPriority] = useState<Priority>(
    task?.priority || "Medium",
  );
  const [dueDate, setDueDate] = useState(task?.dueDate || today);
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || "me");
  const [estimate, setEstimate] = useState(task?.estimate ?? 60);
  return (
    <form
      className="ls-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        onSave({
          id: task?.id || uid(),
          workspaceId: task?.workspaceId || workspaceId,
          title: title.trim(),
          description: description.trim(),
          status,
          priority,
          dueDate,
          assigneeId,
          estimate,
        });
      }}
    >
      <WorkspaceTag id={task?.workspaceId || workspaceId} />
      <label>
        Title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={200}
          placeholder="What needs to get done?"
        />
      </label>
      <label>
        Description (optional)
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Add context for your team…"
        />
      </label>
      <div className="ls-form-pair">
        <label>
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as Status)}
          >
            {STATUSES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
          >
            {PRIORITIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="ls-form-pair">
        <label>
          Due date
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            required
          />
        </label>
        <label>
          Assignee
          <select
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
          >
            <option value="">Unassigned</option>
            {MEMBERS.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.id === "me" ? " (you)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Estimated duration (minutes)
        <input
          type="number"
          min={0}
          max={1440}
          step={5}
          value={estimate}
          required
          onChange={(event) => setEstimate(Number(event.target.value))}
        />
      </label>
      <div className="ls-form-footer">
        <span>Changes stay in this sandbox.</span>
        <button type="button" className="ls-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="ls-primary" disabled={!title.trim()}>
          {task ? "Save changes" : "Create task"}
        </button>
      </div>
    </form>
  );
}

export function EventForm({
  event,
  workspaceId,
  day,
  onSave,
  onClose,
  onJoin,
}: {
  event?: CalendarEvent;
  workspaceId: WorkspaceId;
  day: string;
  onSave: (event: CalendarEvent) => void;
  onClose: () => void;
  onJoin: (id: WorkspaceId) => void;
}) {
  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [date, setDate] = useState(event?.day || day);
  const [start, setStart] = useState(event?.start || "11:00");
  const [end, setEnd] = useState(event?.end || "11:30");
  const [error, setError] = useState("");
  return (
    <form
      className="ls-form"
      onSubmit={(submit) => {
        submit.preventDefault();
        if (!title.trim()) return;
        if (end <= start) {
          setError("Choose an end time after the start time.");
          return;
        }
        onSave({
          id: event?.id || uid(),
          workspaceId: event?.workspaceId || workspaceId,
          title: title.trim(),
          description: description.trim(),
          day: date,
          start,
          end,
        });
      }}
    >
      <WorkspaceTag id={event?.workspaceId || workspaceId} />
      <label>
        Title
        <input
          value={title}
          onChange={(change) => setTitle(change.target.value)}
          required
          maxLength={200}
          placeholder="Name your event"
        />
      </label>
      <label>
        Date
        <input
          type="date"
          value={date}
          onChange={(change) => setDate(change.target.value)}
          required
        />
      </label>
      <div className="ls-form-pair">
        <label>
          Start time
          <input
            type="time"
            value={start}
            onChange={(change) => {
              setStart(change.target.value);
              setError("");
            }}
            required
          />
        </label>
        <label>
          End time
          <input
            type="time"
            value={end}
            onChange={(change) => {
              setEnd(change.target.value);
              setError("");
            }}
            required
          />
        </label>
      </div>
      <label>
        Description (optional)
        <textarea
          value={description}
          onChange={(change) => setDescription(change.target.value)}
          rows={3}
          maxLength={4000}
        />
      </label>
      <div className="ls-event-attendees">
        <span>Attendees</span>
        <p>{MEMBERS.map((member) => member.name).join(" · ")}</p>
      </div>
      {event && (
        <button
          type="button"
          className="ls-secondary"
          onClick={() => onJoin(event.workspaceId)}
        >
          Open workspace meeting room · {formatTime(event.start)}
        </button>
      )}
      {error && (
        <p className="ls-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="ls-form-footer">
        <span>Changes stay in this sandbox.</span>
        <button type="button" className="ls-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="ls-primary" disabled={!title.trim()}>
          {event ? "Save event" : "Create event"}
        </button>
      </div>
    </form>
  );
}

function LocalFilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    let active = true;
    setUrl(objectUrl);
    if (
      file.type.startsWith("text/") ||
      /\.(txt|md|csv|json)$/i.test(file.name)
    ) {
      file
        .slice(0, 50000)
        .text()
        .then((value) => {
          if (active) setText(value);
        });
    }
    return () => {
      active = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);
  return (
    <div className="ls-local-preview">
      {file.type.startsWith("image/") ? (
        <img src={url} alt={file.name} />
      ) : file.type === "application/pdf" ? (
        <iframe title={`Preview of ${file.name}`} src={url} />
      ) : file.type.startsWith("video/") ? (
        <video src={url} controls />
      ) : file.type.startsWith("audio/") ? (
        <audio src={url} controls />
      ) : text ? (
        <pre>{text}</pre>
      ) : (
        <p>Download this version to open it in its original app.</p>
      )}
      <a className="ls-secondary" href={url} download={file.name}>
        Download {file.name}
      </a>
    </div>
  );
}
export function AssetDetails({
  asset,
  upload,
}: {
  asset: Asset;
  upload: (files: FileList | null, assetId?: string) => void;
}) {
  const [selected, setSelected] = useState(asset.versions.length - 1);
  const version = asset.versions[selected] || asset.versions.at(-1)!;
  return (
    <>
      <div className="ls-asset-meta">
        <WorkspaceTag id={asset.workspaceId} />
        <span>
          {version.size} · V{selected + 1}
        </span>
      </div>
      {version.file ? (
        <LocalFilePreview key={version.id} file={version.file} />
      ) : (
        <div className="ls-sample-file">
          <FileText size={32} />
          <span>Sample file preview</span>
          <h3>{asset.name}</h3>
          <p>
            {workspaceFor(asset.workspaceId).name}'s project reference. In the
            app, open files here and download any saved version.
          </p>
          <div>
            <Check size={15} />
            Latest draft shared with the team
          </div>
        </div>
      )}
      <div className="ls-version-heading">
        <h3>Version history</h3>
        <label className="ls-secondary ls-upload-button">
          <Plus size={13} />
          Add version
          <input
            type="file"
            onChange={(event) => {
              if (event.target.files?.length) {
                setSelected(asset.versions.length);
                upload(event.target.files, asset.id);
              }
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="ls-version-list">
        {[...asset.versions].reverse().map((item, index) => {
          const number = asset.versions.length - index;
          return (
            <button
              type="button"
              key={item.id}
              aria-pressed={version.id === item.id}
              onClick={() => setSelected(number - 1)}
            >
              <span>V{number}</span>
              <strong>{item.name}</strong>
              <small>
                {item.size}
                {index === 0 ? " · Latest" : ""}
              </small>
            </button>
          );
        })}
      </div>
      <p className="ls-dialog-note">
        Files added here stay in your browser until you reset or leave the page.
      </p>
    </>
  );
}

export function NotificationList({
  data,
  updates,
  openTask,
}: {
  data: SandboxData;
  updates: string[];
  openTask: (task: Task) => void;
}) {
  return (
    <div className="ls-notifications">
      <p className="ls-dialog-note">Your sample workspace updates.</p>
      {updates.map((update, index) => (
        <p key={`${index}-${update}`}>
          <Check size={14} />
          {update}
        </p>
      ))}
      <h3>Assigned to you</h3>
      {data.tasks
        .filter(
          (task) => task.assigneeId === "me" && task.status !== "COMPLETED",
        )
        .map((task) => (
          <button
            type="button"
            className="ls-notification-task"
            key={task.id}
            onClick={() => openTask(task)}
          >
            <WorkspaceTag id={task.workspaceId} />
            <strong>{task.title}</strong>
          </button>
        ))}
    </div>
  );
}

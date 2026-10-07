import { useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarClock,
  Check,
  CheckSquare,
  Clock3,
  FileText,
  FolderOpen,
  Hash,
  ListChecks,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Plus,
  Send,
  ShieldCheck,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import {
  MEMBERS,
  STATUSES,
  WORKSPACES,
  addDays,
  conflictsFor,
  dateKey,
  formatDay,
  formatTime,
  memberFor,
  minutes,
  myTasks,
  uid,
  workspaceFor,
} from "./model";
import type {
  CalendarEvent,
  SandboxData,
  Task,
  View,
  WorkspaceId,
} from "./model";

export type ViewProps = {
  view: View;
  workspaceId: WorkspaceId | null;
  data: SandboxData;
  setData: Dispatch<SetStateAction<SandboxData>>;
  navigate: (view: View, workspaceId?: WorkspaceId) => void;
  openTask: (task?: Task) => void;
  openEvent: (event?: CalendarEvent, day?: string) => void;
  openAsset: (id: string) => void;
  upload: (files: FileList | null, assetId?: string) => void;
  announce: (message: string) => void;
};

export function Avatar({
  id = "me",
  large = false,
}: {
  id?: string;
  large?: boolean;
}) {
  const member = memberFor(id);
  return (
    <span
      className={`ls-avatar ${id} ${large ? "is-large" : ""}`}
      title={member?.name}
    >
      {member?.initials || "?"}
    </span>
  );
}
export function WorkspaceTag({ id }: { id: WorkspaceId }) {
  return (
    <span className={`ls-workspace-tag ${id}`}>
      <span />
      {workspaceFor(id).name}
    </span>
  );
}
function PriorityTag({ task }: { task: Task }) {
  return (
    <span className={`ls-priority ${task.priority.toLowerCase()}`}>
      {task.priority}
    </span>
  );
}
function Heading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="ls-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function Card({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ls-card ${className}`}>
      <div className="ls-card-heading">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="ls-empty">{children}</p>;
}
function TaskRows({
  tasks,
  data,
  onOpen,
  showWorkspace = true,
}: {
  tasks: Task[];
  data: SandboxData;
  onOpen: (task: Task) => void;
  showWorkspace?: boolean;
}) {
  if (!tasks.length) return <Empty>You're all caught up here.</Empty>;
  return (
    <div className="ls-task-rows">
      {tasks.map((task) => (
        <button
          type="button"
          key={task.id}
          className="ls-task-row"
          onClick={() => onOpen(task)}
        >
          <CheckSquare size={16} aria-hidden="true" />
          <span className="ls-row-body">
            <strong>{task.title}</strong>
            <span className="ls-row-meta">
              {showWorkspace && <WorkspaceTag id={task.workspaceId} />}
              <PriorityTag task={task} />
            </span>
          </span>
          <span className="ls-due">{formatDay(task.dueDate, data.today)}</span>
        </button>
      ))}
    </div>
  );
}
function EventRows({
  events,
  data,
  onOpen,
  showWorkspace = true,
}: {
  events: CalendarEvent[];
  data: SandboxData;
  onOpen: (event: CalendarEvent) => void;
  showWorkspace?: boolean;
}) {
  if (!events.length) return <Empty>Nothing scheduled here yet.</Empty>;
  return (
    <div className="ls-event-rows">
      {events.map((event) => (
        <button
          type="button"
          className="ls-event-row"
          key={event.id}
          onClick={() => onOpen(event)}
        >
          <span className="ls-time-block">{formatTime(event.start)}</span>
          <span className="ls-row-body">
            <strong>{event.title}</strong>
            {showWorkspace && <WorkspaceTag id={event.workspaceId} />}
            <small>
              {formatDay(event.day, data.today)} · {formatTime(event.start)}–
              {formatTime(event.end)}
            </small>
          </span>
        </button>
      ))}
    </div>
  );
}
function ConflictCard({
  data,
  openTask,
  openEvent,
}: Pick<ViewProps, "data" | "openTask" | "openEvent">) {
  const conflicts = conflictsFor(data);
  return (
    <section
      id="ls-conflicts"
      className={`ls-conflicts ${conflicts.length ? "has-conflicts" : ""}`}
      aria-label="Cross-workspace conflicts"
    >
      {conflicts.length ? (
        <>
          <div className="ls-conflict-heading">
            <AlertTriangle size={18} aria-hidden="true" />
            <div>
              <h3>Cross-workspace conflicts</h3>
              <p>Review the commitments that need your attention.</p>
            </div>
            <span className="ls-count">{conflicts.length}</span>
          </div>
          {conflicts.map((conflict) => (
            <div className="ls-conflict" key={conflict.id}>
              <strong>
                {conflict.title}{" "}
                <span>· {formatDay(conflict.day, data.today)}</span>
              </strong>
              <div className="ls-conflict-items">
                {conflict.tasks.map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    onClick={() => openTask(task)}
                  >
                    <WorkspaceTag id={task.workspaceId} />
                    {task.title}
                  </button>
                ))}
                {conflict.events.map((event) => (
                  <button
                    type="button"
                    key={event.id}
                    onClick={() => openEvent(event)}
                  >
                    <WorkspaceTag id={event.workspaceId} />
                    {event.title} · {formatTime(event.start)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="ls-conflict-heading">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <h3>No clashes right now</h3>
            <p>Your sample commitments across teams are clear.</p>
          </div>
        </div>
      )}
    </section>
  );
}
function Skyline({
  data,
  workspaceId,
  onSelect,
}: {
  data: SandboxData;
  workspaceId?: WorkspaceId;
  onSelect: (day: string) => void;
}) {
  return (
    <div
      className="ls-skyline"
      aria-label={workspaceId ? "Workspace week" : "Your next 14 days"}
    >
      {Array.from({ length: workspaceId ? 7 : 14 }, (_, index) => {
        const day = addDays(data.today, index);
        const tasks = data.tasks.filter(
          (task) =>
            task.dueDate === day &&
            task.status !== "COMPLETED" &&
            (workspaceId
              ? task.workspaceId === workspaceId
              : task.assigneeId === "me"),
        );
        const events = data.events.filter(
          (event) =>
            event.day === day &&
            (!workspaceId || event.workspaceId === workspaceId),
        );
        return (
          <button
            type="button"
            key={day}
            className={index === 0 ? "is-today" : ""}
            onClick={() => onSelect(day)}
            aria-label={`${formatDay(day, data.today)}: ${tasks.length} deadlines, ${events.length} meetings`}
          >
            <span className="ls-skyline-bar">
              <i
                style={{
                  height: `${12 + Math.min(tasks.length * 18 + events.length * 12, 60)}px`,
                }}
              />
              <span>{tasks.length + events.length || ""}</span>
            </span>
            <small>
              {new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
                weekday: "narrow",
              })}
            </small>
            <b>{Number(day.slice(-2))}</b>
          </button>
        );
      })}
    </div>
  );
}
function Dashboard(props: ViewProps) {
  const { data, navigate, openTask, openEvent } = props;
  const pending = myTasks(data);
  const events = data.events
    .filter((event) => event.day >= data.today)
    .sort((a, b) => `${a.day}${a.start}`.localeCompare(`${b.day}${b.start}`));
  const dueToday = pending.filter((task) => task.dueDate === data.today);
  const conflicts = conflictsFor(data);
  const metrics = [
    {
      label: "Due today",
      value: dueToday.length,
      detail: "Across your workspaces",
      Icon: CalendarClock,
    },
    {
      label: "Overdue",
      value: pending.filter((task) => task.dueDate < data.today).length,
      detail: "Keep your work on track",
      Icon: Clock3,
    },
    {
      label: "Meetings today",
      value: events.filter((event) => event.day === data.today).length,
      detail: "Your shared calendars",
      Icon: Video,
    },
    {
      label: "Open tasks",
      value: pending.length,
      detail: "Assigned to you",
      Icon: ListChecks,
    },
  ];
  return (
    <>
      <section className="ls-hero-panel">
        <div className="ls-hero-copy">
          <p className="ls-eyebrow">
            {new Date(`${data.today}T12:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}{" "}
            · 3 workspaces
          </p>
          <h2>Good morning, Alex.</h2>
          <p>
            {dueToday.length} deadlines and{" "}
            {events.filter((event) => event.day === data.today).length} meetings
            today. Let's make room for what matters.
          </p>
          <button
            type="button"
            className="ls-clash-pill"
            onClick={() =>
              document
                .getElementById("ls-conflicts")
                ?.scrollIntoView({ behavior: "auto", block: "nearest" })
            }
          >
            {conflicts.length ? (
              <AlertTriangle size={13} />
            ) : (
              <ShieldCheck size={13} />
            )}
            {conflicts.length
              ? `${conflicts.length} ${conflicts.length === 1 ? "clash" : "clashes"} to resolve`
              : "No clashes right now"}
          </button>
        </div>
        <Skyline data={data} onSelect={() => navigate("plan")} />
      </section>
      <div className="ls-metrics">
        {metrics.map(({ label, value, detail, Icon }) => (
          <button
            type="button"
            key={label}
            className="ls-metric ls-card"
            onClick={() => navigate("plan")}
          >
            <Icon size={16} aria-hidden="true" />
            <strong>{value}</strong>
            <span>{label}</span>
            <small>{detail}</small>
          </button>
        ))}
      </div>
      <ConflictCard data={data} openTask={openTask} openEvent={openEvent} />
      <div className="ls-two-col">
        <Card
          title="Pending tasks"
          action={
            <button
              type="button"
              className="ls-text-button"
              onClick={() => navigate("plan")}
            >
              My Plan
            </button>
          }
        >
          <TaskRows tasks={pending} data={data} onOpen={openTask} />
        </Card>
        <Card title="Upcoming events">
          <EventRows
            events={events.slice(0, 3)}
            data={data}
            onOpen={openEvent}
          />
        </Card>
      </div>
      <div className="ls-workspace-cards">
        {WORKSPACES.map((workspace) => (
          <button
            type="button"
            className="ls-workspace-card ls-card"
            key={workspace.id}
            onClick={() => navigate("overview", workspace.id)}
          >
            <span className={`ls-workspace-mark ${workspace.id}`}>
              {workspace.initial}
            </span>
            <span>
              <strong>{workspace.name}</strong>
              <small>
                {
                  data.tasks.filter(
                    (task) =>
                      task.workspaceId === workspace.id &&
                      task.status !== "COMPLETED",
                  ).length
                }{" "}
                open tasks · 3 members
              </small>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
function WorkspaceOverview(props: ViewProps) {
  const { data, workspaceId, navigate, openTask, openEvent } = props;
  const workspace = workspaceFor(workspaceId!);
  const tasks = data.tasks.filter((task) => task.workspaceId === workspace.id);
  const events = data.events
    .filter(
      (event) => event.workspaceId === workspace.id && event.day >= data.today,
    )
    .sort((a, b) => `${a.day}${a.start}`.localeCompare(`${b.day}${b.start}`));
  const messages = data.messages.filter(
    (message) =>
      message.workspaceId === workspace.id &&
      !message.channel.startsWith("dm-"),
  );
  return (
    <>
      <section className="ls-hero-panel">
        <div className="ls-hero-copy">
          <p className="ls-eyebrow">{workspace.type} · 3 members</p>
          <h2>{workspace.name}</h2>
          <p>Your team's work, conversations, and next steps.</p>
          <div className="ls-hero-stats">
            <span>
              <b>
                {tasks.filter((task) => task.status !== "COMPLETED").length}
              </b>{" "}
              open tasks
            </span>
            <span>
              <b>
                {tasks.filter((task) => task.status === "COMPLETED").length}
              </b>{" "}
              completed
            </span>
          </div>
        </div>
        <Skyline
          data={data}
          workspaceId={workspace.id}
          onSelect={() => navigate("calendar", workspace.id)}
        />
      </section>
      <div className="ls-two-col">
        <Card
          title="Task queue"
          action={
            <button
              type="button"
              className="ls-text-button"
              onClick={() => navigate("tasks", workspace.id)}
            >
              View board
            </button>
          }
        >
          <TaskRows
            tasks={tasks.filter((task) => task.status !== "COMPLETED")}
            data={data}
            onOpen={openTask}
            showWorkspace={false}
          />
        </Card>
        <Card
          title="Meeting room"
          action={
            <button
              type="button"
              className="ls-text-button"
              onClick={() => navigate("meeting", workspace.id)}
            >
              Open room
            </button>
          }
        >
          <EventRows
            events={events}
            data={data}
            onOpen={openEvent}
            showWorkspace={false}
          />
          <button
            type="button"
            className="ls-secondary"
            onClick={() => openEvent()}
          >
            <Plus size={14} />
            Schedule a meeting
          </button>
        </Card>
      </div>
      <div className="ls-two-col">
        <Card
          title="Team chat"
          action={
            <button
              type="button"
              className="ls-text-button"
              onClick={() => navigate("chat", workspace.id)}
            >
              Open chat
            </button>
          }
        >
          {messages.slice(-2).map((message) => (
            <div className="ls-activity" key={message.id}>
              <Avatar id={message.authorId} />
              <div>
                <strong>
                  {memberFor(message.authorId)?.name}
                  <small>#{message.channel}</small>
                </strong>
                <p>{message.text}</p>
              </div>
            </div>
          ))}
        </Card>
        <Card
          title="Recent files"
          action={
            <button
              type="button"
              className="ls-text-button"
              onClick={() => navigate("storage", workspace.id)}
            >
              All files
            </button>
          }
        >
          {data.assets
            .filter((asset) => asset.workspaceId === workspace.id)
            .map((asset) => (
              <button
                type="button"
                className="ls-file-row"
                key={asset.id}
                onClick={() => props.openAsset(asset.id)}
              >
                <FileText size={20} />
                <span>
                  <strong>{asset.name}</strong>
                  <small>
                    {asset.versions.at(-1)?.size} · V{asset.versions.length}
                  </small>
                </span>
              </button>
            ))}
        </Card>
      </div>
    </>
  );
}
function Plan(props: ViewProps) {
  const { data, openTask, openEvent } = props;
  const [capacity, setCapacity] = useState(4);
  const [mode, setMode] = useState("day");
  const tasks = myTasks(data);
  const todayMinutes =
    tasks
      .filter((task) => task.dueDate === data.today)
      .reduce((sum, task) => sum + task.estimate, 0) +
    data.events
      .filter((event) => event.day === data.today)
      .reduce(
        (sum, event) => sum + minutes(event.end) - minutes(event.start),
        0,
      );
  const days = [
    ...new Set([
      data.today,
      ...tasks.map((task) => task.dueDate),
      ...data.events.map((event) => event.day),
    ]),
  ]
    .filter((day) => day >= data.today)
    .sort();
  return (
    <>
      <Heading
        title="My Plan"
        subtitle="Your assigned tasks and meetings across every workspace."
        action={
          <label className="ls-capacity">
            Hours per day
            <select
              value={capacity}
              onChange={(event) => setCapacity(Number(event.target.value))}
            >
              {[2, 4, 6, 8].map((hours) => (
                <option value={hours} key={hours}>
                  {hours}h
                </option>
              ))}
            </select>
          </label>
        }
      />
      <div className="ls-plan-summary ls-card">
        <div>
          <strong>{tasks.length} open tasks</strong>
          <span>
            {todayMinutes / 60}h committed today · {capacity}h capacity
          </span>
        </div>
        <div
          className={`ls-capacity-track ${todayMinutes > capacity * 60 ? "over-capacity" : ""}`}
        >
          <span
            style={{
              width: `${Math.min(100, (todayMinutes / (capacity * 60)) * 100)}%`,
            }}
          />
        </div>
        <small>
          {todayMinutes > capacity * 60
            ? "Today's estimates exceed your daily capacity."
            : "Today's estimates fit your daily capacity."}
        </small>
      </div>
      <div className="ls-segmented" aria-label="Plan view">
        {[
          ["day", "Day by day"],
          ["week", "Week"],
          ["calendar", "Calendar"],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={mode === id}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <ConflictCard data={data} openTask={openTask} openEvent={openEvent} />
      {mode === "calendar" ? (
        <CalendarView {...props} personal />
      ) : (
        <div className={mode === "week" ? "ls-plan-week" : "ls-plan-days"}>
          {(mode === "week"
            ? Array.from({ length: 7 }, (_, index) =>
                addDays(data.today, index),
              )
            : days
          ).map((day) => (
            <Card
              key={day}
              title={`${formatDay(day, data.today)} · ${new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}`}
            >
              <EventRows
                events={data.events.filter((event) => event.day === day)}
                data={data}
                onOpen={openEvent}
              />
              <TaskRows
                tasks={tasks.filter((task) => task.dueDate === day)}
                data={data}
                onOpen={openTask}
              />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
function TaskBoard({
  data,
  setData,
  workspaceId,
  openTask,
  announce,
}: ViewProps) {
  const tasks = data.tasks.filter((task) => task.workspaceId === workspaceId);
  function move(id: string, status: Task["status"], beforeId?: string) {
    const task = data.tasks.find(
      (item) => item.id === id && item.workspaceId === workspaceId,
    );
    if (!task || id === beforeId) return;
    setData((current) => {
      const remaining = current.tasks.filter((item) => item.id !== id);
      const index = beforeId
        ? remaining.findIndex((item) => item.id === beforeId)
        : -1;
      remaining.splice(index < 0 ? remaining.length : index, 0, {
        ...task,
        status,
      });
      return { ...current, tasks: remaining };
    });
    announce(
      `${task.title} moved to ${STATUSES.find((item) => item.id === status)?.label}.`,
    );
  }
  return (
    <>
      <Heading
        title="Tasks"
        subtitle={`${tasks.length} tasks · Drag cards between columns, or open one to update it.`}
        action={
          <button
            type="button"
            className="ls-primary"
            onClick={() => openTask()}
          >
            <Plus size={15} />
            New task
          </button>
        }
      />
      <div className="ls-board">
        {STATUSES.map((status) => (
          <section
            key={status.id}
            className={`ls-board-column ${status.id.toLowerCase()}`}
            aria-label={status.label}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("application/x-loft-task"))
                event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              move(
                event.dataTransfer.getData("application/x-loft-task"),
                status.id,
              );
            }}
          >
            <h3>
              <span className="ls-status-dot" />
              {status.label}
              <span className="ls-count">
                {tasks.filter((task) => task.status === status.id).length}
              </span>
            </h3>
            {tasks
              .filter((task) => task.status === status.id)
              .map((task) => (
                <article
                  key={task.id}
                  className="ls-board-task"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/x-loft-task",
                      task.id,
                    );
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    if (
                      event.dataTransfer.types.includes(
                        "application/x-loft-task",
                      )
                    ) {
                      event.preventDefault();
                      event.stopPropagation();
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    move(
                      event.dataTransfer.getData("application/x-loft-task"),
                      status.id,
                      task.id,
                    );
                  }}
                >
                  <button
                    type="button"
                    className="ls-task-open"
                    onClick={() => openTask(task)}
                    aria-label={`Open task: ${task.title}`}
                  >
                    <strong>{task.title}</strong>
                    <PriorityTag task={task} />
                    <span className="ls-task-card-footer">
                      <span>
                        <CalendarDays size={12} />
                        {formatDay(task.dueDate, data.today)}
                      </span>
                      <Avatar id={task.assigneeId} />
                    </span>
                  </button>
                </article>
              ))}
            {!tasks.some((task) => task.status === status.id) && (
              <p className="ls-column-empty">Drop a task here</p>
            )}
            <button
              type="button"
              className="ls-add-task"
              onClick={() => openTask()}
            >
              <Plus size={13} />
              New task
            </button>
          </section>
        ))}
      </div>
    </>
  );
}
function CalendarView(props: ViewProps & { personal?: boolean }) {
  const { data, workspaceId, openEvent, openTask, personal = false } = props;
  const [month, setMonth] = useState(data.today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(data.today);
  const [mode, setMode] = useState("month");
  const first = new Date(`${month}-01T12:00:00`);
  const gridStart =
    mode === "month"
      ? addDays(dateKey(first), -first.getDay())
      : addDays(selectedDay, -new Date(`${selectedDay}T12:00:00`).getDay());
  const events = data.events.filter(
    (event) => personal || event.workspaceId === workspaceId,
  );
  const tasks = personal
    ? myTasks(data)
    : data.tasks.filter(
        (task) =>
          task.workspaceId === workspaceId && task.status !== "COMPLETED",
      );
  const days = Array.from({ length: mode === "month" ? 42 : 7 }, (_, index) =>
    addDays(gridStart, index),
  );
  return (
    <>
      <div className="ls-calendar-heading">
        <label>
          <span className="ls-sr-only">Calendar month</span>
          <input
            type="month"
            value={month}
            required
            onChange={(event) => {
              if (event.target.value) {
                setMonth(event.target.value);
                setSelectedDay(`${event.target.value}-01`);
              }
            }}
          />
        </label>
        <div className="ls-calendar-actions">
          <button
            type="button"
            className="ls-secondary"
            onClick={() => {
              setMonth(data.today.slice(0, 7));
              setSelectedDay(data.today);
            }}
          >
            Today
          </button>
          <div className="ls-segmented" aria-label="Calendar view">
            {["month", "week"].map((view) => (
              <button
                type="button"
                key={view}
                aria-pressed={mode === view}
                onClick={() => setMode(view)}
              >
                {view === "month" ? "Month" : "Week"}
              </button>
            ))}
          </div>
          {!personal && (
            <button
              type="button"
              className="ls-primary"
              onClick={() => openEvent(undefined, selectedDay)}
            >
              <Plus size={14} />
              New event
            </button>
          )}
        </div>
      </div>
      <div className="ls-calendar-layout">
        <div className="ls-calendar-scroll">
          <div
            className={`ls-month-grid ${mode === "week" ? "is-week" : ""}`}
            aria-label="Calendar dates"
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span className="ls-weekday" key={day}>
                {day}
              </span>
            ))}
            {days.map((day) => {
              const dayEvents = events.filter((event) => event.day === day);
              const dayTasks = tasks.filter((task) => task.dueDate === day);
              return (
                <button
                  type="button"
                  key={day}
                  className={`ls-calendar-day ${day === selectedDay ? "is-selected" : ""} ${day === data.today ? "is-today" : ""} ${day.slice(0, 7) !== month ? "other-month" : ""}`}
                  aria-pressed={day === selectedDay}
                  aria-label={`${new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" })}, ${dayEvents.length} events, ${dayTasks.length} deadlines`}
                  onClick={() => setSelectedDay(day)}
                >
                  <b>{Number(day.slice(-2))}</b>
                  {dayEvents.map((event) => (
                    <span
                      className={`ls-calendar-item ${event.workspaceId}`}
                      key={event.id}
                    >
                      {event.start} {event.title}
                    </span>
                  ))}
                  {dayTasks.length > 0 && (
                    <span className="ls-calendar-deadline">
                      {dayTasks.length}{" "}
                      {dayTasks.length === 1 ? "task due" : "tasks due"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <Card
          title={formatDay(selectedDay, data.today)}
          className="ls-calendar-agenda"
        >
          <EventRows
            events={events.filter((event) => event.day === selectedDay)}
            data={data}
            onOpen={openEvent}
            showWorkspace={personal}
          />
          <TaskRows
            tasks={tasks.filter((task) => task.dueDate === selectedDay)}
            data={data}
            onOpen={openTask}
            showWorkspace={personal}
          />
          {!personal && (
            <button
              type="button"
              className="ls-text-button"
              onClick={() => openEvent(undefined, selectedDay)}
            >
              <Plus size={13} />
              Add an event
            </button>
          )}
        </Card>
      </div>
    </>
  );
}
function ChatView({
  data,
  setData,
  workspaceId,
  view,
  announce,
  navigate,
}: ViewProps) {
  const direct = view === "messages";
  const [channel, setChannel] = useState(direct ? "dm-jamie" : "general");
  const [draft, setDraft] = useState("");
  const messages = data.messages.filter(
    (message) =>
      message.channel === channel &&
      (direct || message.workspaceId === workspaceId),
  );
  const label = direct
    ? memberFor(channel.replace("dm-", ""))?.name || "Jamie Lee"
    : `# ${channel}`;
  function send() {
    if (!draft.trim()) return;
    const text = draft.trim();
    setData((current) => ({
      ...current,
      messages: [
        ...current.messages,
        {
          id: uid(),
          workspaceId: workspaceId || "work",
          channel,
          authorId: "me",
          text,
          time: new Date().toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }),
        },
      ],
    }));
    setDraft("");
    announce("Message sent in the sandbox.");
  }
  return (
    <>
      <Heading
        title={direct ? "Messages" : "Chat"}
        subtitle={
          direct
            ? "Direct conversations, alongside your workspace chats."
            : "Channels keep conversations close to your team's work."
        }
      />
      <div className="ls-chat-layout ls-card">
        <nav
          className="ls-channel-list"
          aria-label={direct ? "Direct conversations" : "Chat channels"}
        >
          <p>{direct ? "Direct messages" : "Channels"}</p>
          {(direct
            ? ["dm-jamie", "dm-riley"]
            : ["general", "project-updates"]
          ).map((id) => (
            <button
              type="button"
              key={id}
              aria-current={channel === id ? "page" : undefined}
              onClick={() => {
                setChannel(id);
                setDraft("");
              }}
            >
              {direct ? (
                <Avatar id={id.replace("dm-", "")} />
              ) : (
                <Hash size={14} />
              )}
              {direct ? memberFor(id.replace("dm-", ""))?.name : id}
            </button>
          ))}
        </nav>
        <section className="ls-chat-thread" aria-label={label}>
          <div className="ls-thread-header">
            <strong>{label}</strong>
            {!direct && (
              <button
                type="button"
                className="ls-text-button"
                onClick={() => navigate("docs", workspaceId!)}
              >
                Open Docs
              </button>
            )}
          </div>
          <div
            className="ls-chat-messages"
            role="log"
            aria-label="Conversation messages"
            aria-live="polite"
          >
            {messages.length ? (
              messages.map((message) => (
                <div className="ls-chat-message" key={message.id}>
                  <Avatar id={message.authorId} />
                  <div>
                    <strong>
                      {memberFor(message.authorId)?.name}
                      <time>{message.time}</time>
                    </strong>
                    <p>{message.text}</p>
                  </div>
                </div>
              ))
            ) : (
              <Empty>Start the conversation with a message.</Empty>
            )}
          </div>
          <form
            className="ls-composer"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <label className="ls-sr-only" htmlFor="ls-message-input">
              {direct ? `Message ${label}` : `Message #${channel}`}
            </label>
            <input
              id="ls-message-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                direct ? `Message ${label}…` : `Message #${channel}…`
              }
              maxLength={2000}
              autoComplete="off"
            />
            <button
              type="submit"
              className="ls-icon-button"
              aria-label="Send message"
              disabled={!draft.trim()}
            >
              <Send size={17} />
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
function MeetingView({ workspaceId, navigate }: ViewProps) {
  const [joined, setJoined] = useState(false);
  const [mic, setMic] = useState(false);
  const [camera, setCamera] = useState(false);
  const [sharing, setSharing] = useState(false);
  const workspace = workspaceFor(workspaceId!);
  return (
    <>
      <Heading title="Meeting" subtitle={`${workspace.name}'s shared room.`} />
      <div className={`ls-meeting ${joined ? "is-joined" : ""}`}>
        {!joined ? (
          <div className="ls-meeting-lobby">
            <span className="ls-meeting-icon">
              <Video size={28} />
            </span>
            <p className="ls-eyebrow">Workspace meeting</p>
            <h3>A meeting is live</h3>
            <p>Jamie and Riley are already here.</p>
            <div className="ls-meeting-avatars">
              <Avatar id="jamie" />
              <Avatar id="riley" />
            </div>
            <button
              type="button"
              className="ls-primary"
              onClick={() => setJoined(true)}
            >
              Join meeting
            </button>
            <button
              type="button"
              className="ls-secondary"
              onClick={() => navigate("calendar", workspace.id)}
            >
              <CalendarDays size={14} />
              View schedule
            </button>
            <small>
              Demo room · camera and microphone controls are simulated.
            </small>
          </div>
        ) : (
          <>
            <div className="ls-meeting-room-header">
              <span className="ls-demo-live">Simulated meeting</span>
              <span>{workspace.name} · 3 participants</span>
            </div>
            <div className="ls-participant-grid">
              {sharing ? (
                <div className="ls-shared-screen">
                  <MonitorUp size={32} />
                  <h3>Research & next steps</h3>
                  <p>Sample screen share</p>
                  <div className="ls-screen-notes">
                    <span>Review the working draft</span>
                    <span>Confirm the deadlines</span>
                    <span>Share the final files</span>
                  </div>
                </div>
              ) : (
                MEMBERS.map((member) => (
                  <div className="ls-participant" key={member.id}>
                    <Avatar id={member.id} large />
                    <span>{member.id === "me" ? "You" : member.name}</span>
                    <small>
                      {member.id === "me"
                        ? camera
                          ? "Sample camera on"
                          : "Camera off"
                        : "Sample participant"}
                    </small>
                  </div>
                ))
              )}
            </div>
            <div className="ls-call-controls">
              <button
                type="button"
                className="ls-icon-button"
                aria-label={
                  mic ? "Mute microphone (demo)" : "Unmute microphone (demo)"
                }
                aria-pressed={mic}
                onClick={() => setMic(!mic)}
              >
                {mic ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
              <button
                type="button"
                className="ls-icon-button"
                aria-label={
                  camera ? "Turn off camera (demo)" : "Turn on camera (demo)"
                }
                aria-pressed={camera}
                onClick={() => setCamera(!camera)}
              >
                {camera ? <Video size={18} /> : <VideoOff size={18} />}
              </button>
              <button
                type="button"
                className="ls-icon-button"
                aria-label={
                  sharing
                    ? "Stop sample screen share"
                    : "Show sample screen share"
                }
                aria-pressed={sharing}
                onClick={() => setSharing(!sharing)}
              >
                <MonitorUp size={18} />
              </button>
              <button
                type="button"
                className="ls-leave"
                onClick={() => {
                  setJoined(false);
                  setMic(false);
                  setCamera(false);
                  setSharing(false);
                }}
              >
                Leave meeting
              </button>
            </div>
            <small className="ls-meeting-disclaimer">
              This sample room simulates the controls in LOFT.
            </small>
          </>
        )}
      </div>
    </>
  );
}
function DocsView({ workspaceId, data, setData, announce }: ViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const documents = data.documents.filter(
    (document) => document.workspaceId === workspaceId,
  );
  const selected = documents.find((document) => document.id === selectedId);
  function update(field: "title" | "body", value: string) {
    setData((current) => ({
      ...current,
      documents: current.documents.map((document) =>
        document.id === selectedId ? { ...document, [field]: value } : document,
      ),
    }));
  }
  return (
    <>
      {selected ? (
        <>
          <div className="ls-document-top">
            <button
              type="button"
              className="ls-text-button"
              onClick={() => setSelectedId(null)}
            >
              <FileText size={14} />
              All Docs
            </button>
            <span>
              <Check size={13} />
              Saved in sandbox
            </span>
          </div>
          <div className="ls-document-editor ls-card">
            <div className="ls-document-access">
              <span>
                <Users size={14} />
                Workspace access
              </span>
              <span>
                <Avatar id="me" />
                Sample editor
              </span>
            </div>
            <div className="ls-document-paper">
              <label className="ls-sr-only" htmlFor="ls-document-title">
                Document title
              </label>
              <input
                id="ls-document-title"
                value={selected.title}
                onChange={(event) => update("title", event.target.value)}
                maxLength={120}
                placeholder="Untitled document"
              />
              <label className="ls-sr-only" htmlFor="ls-document-body">
                Document content
              </label>
              <textarea
                id="ls-document-body"
                value={selected.body}
                onChange={(event) => update("body", event.target.value)}
                maxLength={20000}
                spellCheck
              />
            </div>
            <p className="ls-editor-note">
              Edit this sample draft. In LOFT, your team co-edits rich-text
              documents with live sync.
            </p>
          </div>
        </>
      ) : (
        <>
          <Heading
            title="Docs"
            subtitle="Shared documents everyone in this workspace can co-edit."
            action={
              <button
                type="button"
                className="ls-primary"
                onClick={() => {
                  const id = uid();
                  setData((current) => ({
                    ...current,
                    documents: [
                      ...current.documents,
                      {
                        id,
                        workspaceId: workspaceId!,
                        title: "Untitled document",
                        body: "",
                      },
                    ],
                  }));
                  setSelectedId(id);
                  announce("Sample document created.");
                }}
              >
                <Plus size={14} />
                New document
              </button>
            }
          />
          <div className="ls-document-list">
            {documents.map((document) => (
              <button
                type="button"
                key={document.id}
                className="ls-document-card ls-card"
                onClick={() => setSelectedId(document.id)}
              >
                <FileText size={24} />
                <strong>{document.title || "Untitled document"}</strong>
                <p>
                  {document.body.slice(0, 110) ||
                    "Start writing your team's next idea."}
                </p>
                <small>
                  <Users size={12} />
                  Workspace access
                </small>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
function StorageView({ data, workspaceId, upload, openAsset }: ViewProps) {
  const assets = data.assets.filter(
    (asset) => asset.workspaceId === workspaceId,
  );
  const [dragging, setDragging] = useState(false);
  return (
    <>
      <Heading
        title="Storage"
        subtitle="Workspace files, previews, and version history."
        action={
          <label className="ls-primary ls-upload-button">
            <Plus size={14} />
            Upload file
            <input
              type="file"
              multiple
              onChange={(event) => {
                upload(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        }
      />
      <div
        className={`ls-upload-zone ${dragging ? "is-dragging" : ""}`}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          upload(event.dataTransfer.files);
        }}
      >
        <FolderOpen size={24} />
        <strong>Drop files here, or choose a file above</strong>
        <p>Demo files stay in this browser session.</p>
      </div>
      <div className="ls-storage-count">
        Files <span className="ls-count">{assets.length}</span>
      </div>
      <div className="ls-file-grid">
        {assets.map((asset) => (
          <button
            type="button"
            className="ls-file-card ls-card"
            key={asset.id}
            onClick={() => openAsset(asset.id)}
          >
            <div className="ls-file-thumbnail">
              <FileText size={36} />
              <span>V{asset.versions.length}</span>
            </div>
            <strong>{asset.name}</strong>
            <small>
              {asset.versions.at(-1)?.size} ·{" "}
              {asset.versions.length > 1
                ? `${asset.versions.length} versions`
                : "1 version"}
            </small>
            <span className="ls-file-preview-label">
              Preview & version history
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
function SettingsView({ workspaceId }: ViewProps) {
  const workspace = workspaceId ? workspaceFor(workspaceId) : null;
  return (
    <>
      <Heading
        title="Settings"
        subtitle={
          workspace
            ? "Workspace details and member access."
            : "Your LOFT account preferences."
        }
      />
      <Card title={workspace ? "Workspace" : "Appearance"}>
        {workspace ? (
          <div className="ls-settings-details">
            <span className={`ls-workspace-mark ${workspace.id}`}>
              {workspace.initial}
            </span>
            <div>
              <strong>{workspace.name}</strong>
              <p>{workspace.type} workspace · 3 members</p>
            </div>
            <span className="ls-access-badge">You are an Admin</span>
          </div>
        ) : (
          <p className="ls-settings-note">
            Use the theme control in the top bar to explore LOFT in light or
            dark mode.
          </p>
        )}
      </Card>
      <Card title={workspace ? "Members" : "Sample account"}>
        {(workspace ? MEMBERS : MEMBERS.slice(0, 1)).map((member) => (
          <div className="ls-member-row" key={member.id}>
            <Avatar id={member.id} />
            <span>
              <strong>{member.name}</strong>
              <small>{member.id === "me" ? "You" : "Workspace member"}</small>
            </span>
            <span className="ls-access-badge">{member.role}</span>
          </div>
        ))}
      </Card>
      <p className="ls-settings-note">
        Workspace invitations and account changes are available after signing in
        to LOFT.
      </p>
    </>
  );
}

export function SandboxViews(props: ViewProps) {
  switch (props.view) {
    case "dashboard":
      return <Dashboard {...props} />;
    case "overview":
      return <WorkspaceOverview {...props} />;
    case "plan":
      return <Plan {...props} />;
    case "tasks":
      return <TaskBoard {...props} />;
    case "calendar":
      return <CalendarView {...props} />;
    case "messages":
    case "chat":
      return <ChatView {...props} />;
    case "meeting":
      return <MeetingView {...props} />;
    case "docs":
      return <DocsView {...props} />;
    case "storage":
      return <StorageView {...props} />;
    case "settings":
      return <SettingsView {...props} />;
  }
}

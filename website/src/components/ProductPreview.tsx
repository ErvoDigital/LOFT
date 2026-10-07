import { useRef, useState } from "react";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  FileText,
  FlaskConical,
  FolderOpen,
  Home,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Settings,
  Sun,
  Users,
  Video,
  X,
} from "lucide-react";
import { LOGIN_URL } from "../config";
import {
  Dialog,
  AssetDetails,
  EventForm,
  NotificationList,
  TaskForm,
} from "./sandbox/SandboxDialogs";
import type { SandboxDialog } from "./sandbox/SandboxDialogs";
import { Avatar, SandboxViews } from "./sandbox/SandboxViews";
import {
  MEMBERS,
  WORKSPACES,
  createSandbox,
  fileSize,
  uid,
  workspaceFor,
} from "./sandbox/model";
import type { CalendarEvent, Task, View, WorkspaceId } from "./sandbox/model";
import "./sandbox/sandbox.css";

const GLOBAL_NAV = [
  { id: "dashboard", label: "Dashboard", Icon: Home },
  { id: "plan", label: "My Plan", Icon: CalendarCheck },
  { id: "messages", label: "Messages", Icon: MessageSquare },
] as const;
const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { id: "overview", label: "Overview", Icon: LayoutDashboard },
      { id: "calendar", label: "Calendar", Icon: CalendarDays },
      { id: "tasks", label: "Tasks", Icon: CheckSquare },
    ],
  },
  {
    label: "Collaborate",
    items: [
      { id: "chat", label: "Chat", Icon: MessageSquare },
      { id: "meeting", label: "Meeting", Icon: Video },
    ],
  },
  {
    label: "Files",
    items: [
      { id: "storage", label: "Storage", Icon: FolderOpen },
      { id: "docs", label: "Docs", Icon: FileText },
      { id: "settings", label: "Settings", Icon: Settings },
    ],
  },
] as const;
const TITLES: Record<View, string> = {
  dashboard: "Dashboard",
  plan: "My Plan",
  messages: "Messages",
  overview: "Overview",
  calendar: "Calendar",
  tasks: "Tasks",
  chat: "Chat",
  meeting: "Meeting",
  docs: "Docs",
  storage: "Storage",
  settings: "Settings",
};

export function ProductPreview() {
  const [data, setData] = useState(createSandbox);
  const [view, setView] = useState<View>("dashboard");
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId | null>(null);
  const [theme, setTheme] = useState("dark");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dialog, setDialog] = useState<SandboxDialog | null>(null);
  const [updates, setUpdates] = useState([
    "Your school and client deadlines land on the same day.",
    "Jamie shared the latest presentation in Client team.",
  ]);
  const [unread, setUnread] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const contentRef = useRef<HTMLElement>(null);
  const workspace = workspaceId ? workspaceFor(workspaceId) : null;

  function navigate(nextView: View, nextWorkspace?: WorkspaceId) {
    setView(nextView);
    setWorkspaceId(nextWorkspace ?? null);
    setMobileNavOpen(false);
    setDialog(null);
    contentRef.current?.scrollTo({ top: 0 });
    contentRef.current?.focus({ preventScroll: true });
  }
  function announce(message: string) {
    setFeedback(message);
    setUpdates((current) => [message, ...current].slice(0, 8));
    setUnread(true);
  }
  function reset() {
    setData(createSandbox());
    setView("dashboard");
    setWorkspaceId(null);
    setDialog(null);
    setMobileNavOpen(false);
    setCollapsed(false);
    setResetKey((current) => current + 1);
    setUpdates([
      "Your school and client deadlines land on the same day.",
      "Jamie shared the latest presentation in Client team.",
    ]);
    setUnread(true);
    setFeedback("Sandbox reset. The original sample workspaces are ready.");
    contentRef.current?.scrollTo({ top: 0 });
  }
  function openTask(task?: Task) {
    setDialog({ type: "task", taskId: task?.id });
  }
  function openEvent(event?: CalendarEvent, day?: string) {
    setDialog({ type: "event", eventId: event?.id, day });
  }
  function saveTask(task: Task) {
    const existing = data.tasks.some((item) => item.id === task.id);
    setData((current) => ({
      ...current,
      tasks: existing
        ? current.tasks.map((item) => (item.id === task.id ? task : item))
        : [...current.tasks, task],
    }));
    setDialog(null);
    announce(`${existing ? "Updated" : "Created"} task: ${task.title}.`);
  }
  function saveEvent(event: CalendarEvent) {
    const existing = data.events.some((item) => item.id === event.id);
    setData((current) => ({
      ...current,
      events: existing
        ? current.events.map((item) => (item.id === event.id ? event : item))
        : [...current.events, event],
    }));
    setDialog(null);
    announce(`${existing ? "Updated" : "Scheduled"} event: ${event.title}.`);
  }
  function upload(files: FileList | null, assetId?: string) {
    if (!files?.length) return;
    const versions = Array.from(files).map((file) => ({
      id: uid(),
      name: file.name,
      size: fileSize(file.size),
      file,
    }));
    setData((current) => ({
      ...current,
      assets: assetId
        ? current.assets.map((asset) =>
            asset.id === assetId
              ? { ...asset, versions: [...asset.versions, ...versions] }
              : asset,
          )
        : [
            ...current.assets,
            ...versions.map((version) => ({
              id: uid(),
              workspaceId: workspaceId || "school",
              name: version.name,
              versions: [version],
            })),
          ],
    }));
    announce(
      assetId
        ? `Added ${versions.length === 1 ? "a new version" : `${versions.length} versions`} in sandbox Storage.`
        : `Added ${versions.length} ${versions.length === 1 ? "file" : "files"} to sandbox Storage.`,
    );
  }

  const task =
    dialog?.type === "task"
      ? data.tasks.find((item) => item.id === dialog.taskId)
      : undefined;
  const event =
    dialog?.type === "event"
      ? data.events.find((item) => item.id === dialog.eventId)
      : undefined;
  const asset =
    dialog?.type === "asset"
      ? data.assets.find((item) => item.id === dialog.assetId)
      : undefined;
  const dialogTitle =
    dialog?.type === "task"
      ? task
        ? "Task details"
        : "New task"
      : dialog?.type === "event"
        ? event
          ? "Event details"
          : "New event"
        : dialog?.type === "asset"
          ? asset?.name || "File preview"
          : "Notifications";

  return (
    <figure
      className="loft-sandbox"
      data-theme={theme}
      aria-label="Interactive LOFT sandbox"
    >
      <div className="ls-preview-toolbar">
        <div>
          <span className="ls-sandbox-brand">L</span>
          <strong>LOFT</strong>
          <span className="ls-sandbox-badge">
            <FlaskConical size={12} aria-hidden="true" />
            Interactive sandbox
          </span>
        </div>
        <button type="button" className="ls-reset" onClick={reset}>
          <RotateCcw size={13} aria-hidden="true" />
          <span>Reset demo</span>
        </button>
      </div>
      <div className="ls-sandbox-hint">
        <span>
          Start with your day. Open a workspace. Try the tools your team uses.
        </span>
        <span>Sample data · changes stay here</span>
      </div>
      <div className="ls-app-shell">
        {mobileNavOpen && (
          <button
            type="button"
            className="ls-nav-backdrop"
            aria-label="Close sandbox navigation"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        <aside
          id="ls-navigation"
          className={`ls-navigation ${mobileNavOpen ? "is-open" : ""}`}
          aria-label="LOFT navigation"
          onKeyDown={(key) => {
            if (key.key === "Escape") {
              setMobileNavOpen(false);
              contentRef.current?.focus({ preventScroll: true });
            }
          }}
        >
          <nav className="ls-rail" aria-label="Personal views and workspaces">
            <span className="ls-rail-brand">L</span>
            {GLOBAL_NAV.map(({ id, label, Icon }) => (
              <button
                type="button"
                key={id}
                className="ls-rail-button"
                title={label}
                aria-label={label}
                aria-current={view === id ? "page" : undefined}
                onClick={() => navigate(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
            <span className="ls-rail-divider" />
            {WORKSPACES.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`ls-workspace-mark ${item.id}`}
                title={item.name}
                aria-label={`Open ${item.name} workspace`}
                aria-current={workspaceId === item.id ? "page" : undefined}
                onClick={() => navigate("overview", item.id)}
              >
                {item.initial}
                <span className="ls-rail-label">{item.name}</span>
              </button>
            ))}
            {workspace && collapsed && (
              <button
                type="button"
                className="ls-rail-button ls-panel-open"
                aria-label="Show workspace panel"
                onClick={() => setCollapsed(false)}
              >
                <PanelLeftOpen size={17} />
              </button>
            )}
            <button
              type="button"
              className="ls-rail-button ls-rail-settings"
              aria-label="Account settings"
              title="Settings"
              onClick={() => navigate("settings")}
            >
              <Settings size={17} />
              <span>Settings</span>
            </button>
          </nav>
          {workspace && (
            <nav
              className={`ls-workspace-panel ${collapsed ? "is-collapsed" : ""}`}
              aria-label={`${workspace.name} views`}
            >
              <div className="ls-workspace-panel-heading">
                <span className={`ls-workspace-mark ${workspace.id}`}>
                  {workspace.initial}
                </span>
                <div>
                  <strong>{workspace.name}</strong>
                  <small>{workspace.type} · 3 members</small>
                </div>
                <button
                  type="button"
                  className="ls-icon-button ls-panel-collapse"
                  aria-label="Hide workspace panel"
                  onClick={() => setCollapsed(true)}
                >
                  <PanelLeftClose size={15} />
                </button>
                <button
                  type="button"
                  className="ls-icon-button ls-nav-close"
                  aria-label="Close sandbox navigation"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              {NAV_GROUPS.map((group) => (
                <div className="ls-nav-group" key={group.label}>
                  <p>{group.label}</p>
                  {group.items.map(({ id, label, Icon }) => (
                    <button
                      type="button"
                      key={id}
                      aria-current={view === id ? "page" : undefined}
                      onClick={() => navigate(id, workspace.id)}
                    >
                      <Icon size={15} aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
              ))}
              <div className="ls-nav-group ls-panel-members">
                <p>
                  Members <span>3</span>
                </p>
                {MEMBERS.map((member) => (
                  <div className="ls-panel-member" key={member.id}>
                    <Avatar id={member.id} />
                    <span>
                      {member.name}
                      {member.id === "me" && <small>You · Admin</small>}
                    </span>
                    <i aria-label="Sample presence" />
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="ls-panel-files"
                onClick={() => navigate("storage", workspace.id)}
              >
                <FolderOpen size={14} />
                Workspace files
              </button>
            </nav>
          )}
        </aside>
        <div className="ls-app-main">
          <header className="ls-app-topbar">
            <div>
              <button
                type="button"
                className="ls-icon-button ls-menu-button"
                aria-label="Open sandbox navigation"
                aria-controls="ls-navigation"
                aria-expanded={mobileNavOpen}
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
              >
                <Menu size={18} />
              </button>
              <h2>
                {workspace && (
                  <span>
                    {workspace.name}
                    <b> · </b>
                  </span>
                )}
                {TITLES[view]}
              </h2>
            </div>
            <div>
              <button
                type="button"
                className="ls-icon-button"
                aria-label={
                  theme === "dark"
                    ? "Switch sandbox to light mode"
                    : "Switch sandbox to dark mode"
                }
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                type="button"
                className="ls-icon-button ls-bell"
                aria-label="Open sandbox notifications"
                onClick={() => {
                  setDialog({ type: "notifications" });
                  setUnread(false);
                }}
              >
                <Bell size={16} />
                {unread && <i />}
              </button>
              <button
                type="button"
                className="ls-account-button"
                aria-label="Sample account settings"
                onClick={() => navigate("settings")}
              >
                <Avatar />
              </button>
            </div>
          </header>
          <section
            ref={contentRef}
            className="ls-content"
            tabIndex={-1}
            aria-label={`${workspace ? `${workspace.name} ` : "Personal "}${TITLES[view]}`}
          >
            <SandboxViews
              key={`${resetKey}-${view}-${workspaceId || "personal"}`}
              view={view}
              workspaceId={workspaceId}
              data={data}
              setData={setData}
              navigate={navigate}
              openTask={openTask}
              openEvent={openEvent}
              openAsset={(assetId) => setDialog({ type: "asset", assetId })}
              upload={upload}
              announce={announce}
            />
          </section>
          <div className="ls-app-status">
            <span>
              <span className="ls-status-light" />
              {feedback ||
                "Your personal dashboard connects all three workspaces."}
            </span>
            <span>
              <Users size={12} />
              Alex's sample account
            </span>
          </div>
        </div>
      </div>
      <figcaption>
        <span>
          Explore with sample data. Sign in to bring your own teams together.
        </span>
        <a href={LOGIN_URL}>Open LOFT</a>
      </figcaption>
      <span
        className="ls-sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {feedback}
      </span>
      {dialog && (
        <Dialog
          key={`${dialog.type}-${task?.id || event?.id || asset?.id || "new"}`}
          title={dialogTitle}
          onClose={() => setDialog(null)}
        >
          {dialog.type === "task" && (
            <TaskForm
              task={task}
              workspaceId={workspaceId || "school"}
              today={data.today}
              onSave={saveTask}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog.type === "event" && (
            <EventForm
              event={event}
              workspaceId={workspaceId || "school"}
              day={dialog.day || data.today}
              onSave={saveEvent}
              onClose={() => setDialog(null)}
              onJoin={(id) => navigate("meeting", id)}
            />
          )}
          {dialog.type === "asset" && asset && (
            <AssetDetails asset={asset} upload={upload} />
          )}
          {dialog.type === "notifications" && (
            <NotificationList
              data={data}
              updates={updates}
              openTask={openTask}
            />
          )}
        </Dialog>
      )}
    </figure>
  );
}

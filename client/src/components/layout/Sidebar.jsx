import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { Home, MessageSquare, Calendar, CheckSquare, Video, FolderOpen, FileText, Settings, Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";
import WorkspaceModal from "./WorkspaceModal.jsx";

const COLLAPSE_KEY = "loft:sidebar-collapsed";

function WorkspaceIcon({ workspace, active }) {
  const initials = workspace.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <NavLink
      to={`/workspaces/${workspace.id}/calendar`}
      title={workspace.name}
      className="group relative flex items-center"
    >
      <div
        style={{ backgroundColor: workspace.color }}
        className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold text-white transition-all ${
          active ? "ring-2 ring-brand-400 ring-offset-2 ring-offset-ink-900" : "opacity-70 hover:opacity-100"
        }`}
      >
        {initials}
      </div>
      <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-xs text-white opacity-0 shadow-panel transition-opacity group-hover:opacity-100 z-10">
        {workspace.name}
      </span>
    </NavLink>
  );
}

const navItemClass = ({ isActive }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-white/10 text-white" : "text-ink-400 hover:bg-white/5 hover:text-white"
  }`;

const subNavItemClass = (collapsed) =>
  ({ isActive }) =>
    `flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors ${
      collapsed ? "h-10 w-10 justify-center px-0" : "px-3 py-2"
    } ${isActive ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-ink-100 hover:text-ink-800"}`;

const SUB_NAV_ITEMS = [
  { to: "calendar", label: "Calendar", Icon: Calendar },
  { to: "tasks", label: "Tasks", Icon: CheckSquare },
  { to: "chat", label: "Chat", Icon: MessageSquare },
  { to: "meeting", label: "Meeting", Icon: Video },
  { to: "storage", label: "Storage", Icon: FolderOpen },
  { to: "docs", label: "Docs", Icon: FileText },
  { to: "settings", label: "Settings", Icon: Settings },
];

export default function Sidebar() {
  const { workspaces } = useWorkspaces();
  const { workspaceId } = useParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const activeWorkspace = workspaces.find((w) => w.id === workspaceId);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // localStorage unavailable (private mode, etc.) — collapse state just won't persist.
    }
  }, [collapsed]);

  return (
    <div className="flex h-full print:hidden">
      {/* Rail: global nav + workspace switcher */}
      <div className="flex w-16 flex-col items-center gap-3 border-r border-ink-900 bg-ink-900 py-4">
        <div className="brand-mark mb-1 flex h-9 w-9 items-center justify-center rounded-lg font-bold text-white">
          L
        </div>
        <NavLink to="/" end title="Dashboard" className={({ isActive }) => navItemClass({ isActive }) + " !px-0 !py-0 h-10 w-10 justify-center"}>
          <Home className="h-[18px] w-[18px]" />
        </NavLink>
        <NavLink to="/chat" title="Messages" className={({ isActive }) => navItemClass({ isActive }) + " !px-0 !py-0 h-10 w-10 justify-center"}>
          <MessageSquare className="h-[18px] w-[18px]" />
        </NavLink>

        <div className="my-1 h-px w-8 bg-white/10" />

        <div className="flex flex-col items-center gap-3">
          {workspaces.map((w) => (
            <WorkspaceIcon key={w.id} workspace={w} active={w.id === workspaceId} />
          ))}
        </div>

        <button
          onClick={() => setModalOpen(true)}
          title="Add workspace"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-white/20 text-white/40 hover:border-white/40 hover:text-white"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Contextual panel: sub-nav for the active workspace, collapsible to icon-only */}
      {activeWorkspace && (
        <div
          className={`flex flex-col border-r border-ink-200 bg-white py-4 transition-[width] duration-150 ${
            collapsed ? "w-14 items-center px-2" : "w-52 px-3"
          }`}
        >
          <div className={`mb-4 flex w-full items-start px-1 ${collapsed ? "justify-center" : "justify-between gap-2"}`}>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-800">{activeWorkspace.name}</p>
                <p className="truncate text-xs text-ink-400 capitalize">
                  {activeWorkspace.type} · {activeWorkspace.memberCount} member{activeWorkspace.memberCount === 1 ? "" : "s"}
                </p>
              </div>
            )}
            <button
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="shrink-0 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
          <nav className={`w-full space-y-0.5 ${collapsed ? "flex flex-col items-center" : ""}`}>
            {SUB_NAV_ITEMS.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={`/workspaces/${workspaceId}/${to}`}
                className={subNavItemClass(collapsed)}
                title={collapsed ? label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" /> {!collapsed && label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      <WorkspaceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

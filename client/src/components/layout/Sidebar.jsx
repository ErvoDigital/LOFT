import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useParams, useSearchParams } from "react-router-dom";
import {
  Home,
  MessageSquare,
  Calendar,
  CheckSquare,
  Video,
  FolderOpen,
  Folder as FolderIcon,
  FileText,
  Settings,
  Plus,
  Minus,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarCheck,
  LayoutDashboard,
} from "lucide-react";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";
import { useSocket } from "../../context/SocketContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { usePresence } from "../../context/PresenceContext.jsx";
import * as foldersApi from "../../api/folders.js";
import * as workspacesApi from "../../api/workspaces.js";
import Avatar from "../common/Avatar.jsx";
import WorkspaceModal from "./WorkspaceModal.jsx";
import { displayColor, textOn } from "../../lib/colors.js";

const COLLAPSE_KEY = "loft:sidebar-collapsed";

const initialsOf = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

function WorkspaceIcon({ workspace, active }) {
  const initials = initialsOf(workspace.name);
  return (
    <NavLink
      to={`/workspaces/${workspace.id}/dashboard`}
      title={workspace.name}
      className="group relative flex items-center"
    >
      <div
        style={{ backgroundColor: displayColor(workspace.color), color: textOn(workspace.color) }}
        className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold transition-all ${
          active
            ? "ring-2 ring-brand-400 ring-offset-2 ring-offset-ink-950 shadow-glow-sm"
            : "opacity-60 hover:opacity-100 hover:ring-2 hover:ring-white/20"
        }`}
      >
        {initials}
      </div>
      <span className="pointer-events-none absolute left-full z-10 ml-3 whitespace-nowrap rounded-lg border border-white/10 bg-ink-950/90 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-glass backdrop-blur-xl transition-opacity group-hover:opacity-100">
        {workspace.name}
      </span>
    </NavLink>
  );
}

const navItemClass = ({ isActive }) =>
  `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
    isActive
      ? "bg-gradient-to-br from-brand-500/35 to-brand-800/50 text-white ring-1 ring-brand-400/40"
      : "text-ink-400 hover:bg-white/[0.07] hover:text-white"
  }`;

const subNavItemClass = ({ isActive }) =>
  `group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
    isActive
      ? "bg-gradient-to-r from-brand-500/20 to-brand-500/[0.04] text-brand-700 ring-1 ring-brand-400/30 dark:from-brand-500/25 dark:to-brand-800/10 dark:text-brand-300"
      : "text-ink-500 hover:bg-ink-900/[0.06] hover:text-ink-800 dark:text-ink-400 dark:hover:bg-white/[0.06] dark:hover:text-ink-100"
  }`;

const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { to: "dashboard", label: "Overview", Icon: LayoutDashboard },
      { to: "calendar", label: "Calendar", Icon: Calendar },
      { to: "tasks", label: "Tasks", Icon: CheckSquare },
    ],
  },
  {
    label: "Collaborate",
    items: [
      { to: "chat", label: "Chat", Icon: MessageSquare },
      { to: "meeting", label: "Meeting", Icon: Video },
    ],
  },
  {
    label: "Files",
    items: [
      { to: "storage", label: "Storage", Icon: FolderOpen },
      { to: "docs", label: "Docs", Icon: FileText },
      { to: "settings", label: "Settings", Icon: Settings },
    ],
  },
];

const SectionLabel = ({ children, action }) => (
  <div className="mb-1 mt-3 flex items-center justify-between px-3 first:mt-0">
    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
      {children}
    </span>
    {action}
  </div>
);

// One row of the document tree. Expand/collapse is plus/minus — the design
// system has no chevrons.
function TreeNode({ folder, childrenOf, depth, workspaceId, activeFolderId }) {
  const [open, setOpen] = useState(depth === 0);
  const kids = childrenOf.get(folder.id) || [];
  const active = activeFolderId === folder.id;

  return (
    <>
      <div
        className={`group flex items-center gap-1 rounded-lg pr-1.5 transition-colors ${
          active ? "bg-brand-500/15 ring-1 ring-brand-400/30" : "hover:bg-ink-900/[0.05] dark:hover:bg-white/[0.05]"
        }`}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {kids.length > 0 ? (
          <button
            onClick={() => setOpen((o) => !o)}
            title={open ? "Collapse" : "Expand"}
            aria-label={open ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-400 transition-colors hover:text-brand-600 dark:hover:text-brand-300"
          >
            {open ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" />
        )}
        <NavLink
          to={`/workspaces/${workspaceId}/storage?folder=${folder.id}`}
          title={folder.name}
          className={`flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-xs font-medium ${
            active
              ? "text-brand-700 dark:text-brand-300"
              : "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100"
          }`}
        >
          <FolderIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{folder.name}</span>
        </NavLink>
        <span className="shrink-0 text-[10px] tabular-nums text-ink-400 dark:text-ink-500">{folder.assetCount}</span>
      </div>
      {open && kids.map((k) => (
        <TreeNode
          key={k.id}
          folder={k}
          childrenOf={childrenOf}
          depth={depth + 1}
          workspaceId={workspaceId}
          activeFolderId={activeFolderId}
        />
      ))}
    </>
  );
}

function DocumentTree({ workspaceId, activeFolderId }) {
  const { socket } = useSocket();
  const [folders, setFolders] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    // Fail soft: the tree is a convenience, never a reason to break the shell.
    foldersApi
      .listFolders(workspaceId)
      .then((f) => !cancelled && setFolders(f))
      .catch(() => !cancelled && setFolders([]));
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!socket) return;
    const reload = () => foldersApi.listFolders(workspaceId).then(setFolders).catch(() => {});
    const events = ["folder:created", "folder:updated", "folder:deleted", "asset:created", "asset:deleted"];
    events.forEach((e) => socket.on(e, reload));
    return () => events.forEach((e) => socket.off(e, reload));
  }, [socket, workspaceId]);

  const childrenOf = useMemo(() => {
    const map = new Map();
    for (const f of folders) {
      const key = f.parentId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    }
    return map;
  }, [folders]);

  const q = query.trim().toLowerCase();
  const matches = q ? folders.filter((f) => f.name.toLowerCase().includes(q)) : null;

  return (
    <div className="px-1">
      <div className="relative mb-1.5 px-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search folders…"
          aria-label="Search folders"
          className="input !py-1.5 !pl-7 !text-xs"
        />
      </div>

      {folders.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-ink-400">No folders yet.</p>
      ) : matches ? (
        matches.length === 0 ? (
          <p className="px-3 py-2 text-[11px] text-ink-400">No match.</p>
        ) : (
          matches.map((f) => (
            <TreeNode
              key={f.id}
              folder={f}
              childrenOf={new Map()}
              depth={0}
              workspaceId={workspaceId}
              activeFolderId={activeFolderId}
            />
          ))
        )
      ) : (
        (childrenOf.get(null) || []).map((f) => (
          <TreeNode
            key={f.id}
            folder={f}
            childrenOf={childrenOf}
            depth={0}
            workspaceId={workspaceId}
            activeFolderId={activeFolderId}
          />
        ))
      )}
    </div>
  );
}

const MEMBER_PREVIEW = 6;

function MembersList({ workspaceId }) {
  const { user } = useAuth();
  const { supported, isOnline } = usePresence();
  const [members, setMembers] = useState([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setShowAll(false);
    workspacesApi
      .getWorkspace(workspaceId)
      .then((ws) => !cancelled && setMembers(ws.members || []))
      .catch(() => !cancelled && setMembers([]));
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Online first when status is known, alphabetical within each group.
  const sorted = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (supported) {
          const diff = Number(isOnline(b.user.id)) - Number(isOnline(a.user.id));
          if (diff) return diff;
        }
        return a.user.name.localeCompare(b.user.name);
      }),
    [members, supported, isOnline]
  );

  if (members.length === 0) return null;

  const onlineCount = members.filter((m) => isOnline(m.user.id)).length;
  const visible = showAll ? sorted : sorted.slice(0, MEMBER_PREVIEW);

  return (
    <>
      <SectionLabel
        action={
          <span className="text-[10px] font-medium tabular-nums text-ink-400 dark:text-ink-500">
            {supported ? `${onlineCount} online` : members.length}
          </span>
        }
      >
        Members
      </SectionLabel>
      <div className="space-y-0.5">
        {visible.map((m) => {
          const online = isOnline(m.user.id);
          const dim = supported && !online;
          return (
            <div
              key={m.id}
              title={supported ? `${m.user.name} · ${online ? "Online" : "Offline"}` : m.user.name}
              className="flex items-center gap-2.5 rounded-lg px-3 py-1.5"
            >
              <span className="relative shrink-0">
                <span className={dim ? "opacity-60" : ""}>
                  <Avatar name={m.user.name} color={m.user.avatarColor} src={m.user.avatarUrl} size={24} />
                </span>
                {supported && (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-ink-900 ${
                      online ? "bg-emerald-500" : "bg-ink-300 dark:bg-ink-600"
                    }`}
                  />
                )}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-xs font-medium ${
                  dim ? "text-ink-400 dark:text-ink-500" : "text-ink-700 dark:text-ink-200"
                }`}
              >
                {m.user.name}
                {m.user.id === user?.id && <span className="font-normal text-ink-400"> (you)</span>}
              </span>
              {supported && <span className="sr-only">{online ? "online" : "offline"}</span>}
            </div>
          );
        })}
      </div>
      {sorted.length > MEMBER_PREVIEW && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="px-3 py-1 text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          {showAll ? "Show less" : `Show all ${sorted.length}`}
        </button>
      )}
    </>
  );
}

export default function Sidebar() {
  const { workspaces } = useWorkspaces();
  const { workspaceId } = useParams();
  const [searchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const activeWorkspace = workspaces.find((w) => w.id === workspaceId);
  const showRailToggle = !!activeWorkspace && collapsed;
  const railToggleRef = useRef(null);
  const panelToggleRef = useRef(null);
  const toggledByUser = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // localStorage unavailable (private mode, etc.) — collapse state just won't persist.
    }
  }, [collapsed]);

  // The button that was just clicked disappears as a result of the click, so
  // hand focus to its counterpart instead of dropping it on <body>.
  useEffect(() => {
    if (!toggledByUser.current) return;
    toggledByUser.current = false;
    (collapsed ? railToggleRef : panelToggleRef).current?.focus({ preventScroll: true });
  }, [collapsed]);

  function setPanelHidden(hidden) {
    toggledByUser.current = true;
    setCollapsed(hidden);
  }

  return (
    <div className="flex h-full gap-2 p-2 print:hidden">
      {/* Rail: global nav + workspace switcher */}
      <div className="flex w-16 flex-col items-center gap-3 rounded-2xl border border-white/[0.07] bg-ink-950/80 py-4 shadow-glass backdrop-blur-xl">
        <div className="flex flex-col items-center">
          {/* Where the panel's hide button lands while the panel is hidden.
              Always mounted and animated on grid rows, so the logo and
              everything below it slide down rather than jump. */}
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              showRailToggle ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <button
                ref={railToggleRef}
                onClick={() => setPanelHidden(false)}
                tabIndex={showRailToggle ? 0 : -1}
                aria-hidden={!showRailToggle}
                title="Show workspace panel"
                aria-label="Show workspace panel"
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-ink-400 transition-all hover:bg-white/[0.07] hover:text-white"
              >
                <PanelLeftOpen className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
          <div className="brand-mark mb-1 flex h-9 w-9 items-center justify-center rounded-xl font-bold text-white shadow-glow-sm">
            L
          </div>
        </div>
        <NavLink to="/" end title="Dashboard" className={({ isActive }) => navItemClass({ isActive }) + " !px-0 !py-0 h-10 w-10 justify-center"}>
          <Home className="h-[18px] w-[18px]" />
        </NavLink>
        <NavLink to="/plan" title="My Plan" className={({ isActive }) => navItemClass({ isActive }) + " !px-0 !py-0 h-10 w-10 justify-center"}>
          <CalendarCheck className="h-[18px] w-[18px]" />
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
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-dashed border-white/20 text-white/40 transition-all hover:border-brand-400/60 hover:bg-brand-500/10 hover:text-brand-300"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Contextual panel for the active workspace — shown or fully hidden */}
      {activeWorkspace && !collapsed && (
        <div className="flex w-60 animate-fade-in flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/60 px-2 py-3 shadow-glass backdrop-blur-xl dark:border-white/[0.07] dark:bg-ink-900/80">
          <div className="mb-2 flex min-w-0 items-center gap-2.5 px-2">
            <div
              style={{ backgroundColor: displayColor(activeWorkspace.color), color: textOn(activeWorkspace.color) }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-semibold"
            >
              {initialsOf(activeWorkspace.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{activeWorkspace.name}</p>
              <p className="truncate text-[11px] capitalize text-ink-400">
                {activeWorkspace.type} · {activeWorkspace.memberCount} member{activeWorkspace.memberCount === 1 ? "" : "s"}
              </p>
            </div>
            <button
              ref={panelToggleRef}
              onClick={() => setPanelHidden(true)}
              title="Hide workspace panel"
              aria-label="Hide workspace panel"
              className="shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-brand-500/10 hover:text-brand-600 dark:hover:bg-white/[0.08] dark:hover:text-brand-300"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 w-full flex-1 overflow-y-auto">
            {NAV_GROUPS.map((group) => (
              <nav key={group.label} className="w-full space-y-0.5">
                <SectionLabel>{group.label}</SectionLabel>
                {group.items.map(({ to, label, Icon }) => (
                  <NavLink key={to} to={`/workspaces/${workspaceId}/${to}`} className={subNavItemClass}>
                    <Icon className="h-4 w-4 shrink-0" /> {label}
                  </NavLink>
                ))}
              </nav>
            ))}

            <MembersList workspaceId={workspaceId} />

            <SectionLabel
              action={
                <NavLink
                  to={`/workspaces/${workspaceId}/storage`}
                  title="Manage folders"
                  aria-label="Manage folders"
                  className="rounded p-0.5 text-ink-400 transition-colors hover:text-brand-600 dark:hover:text-brand-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                </NavLink>
              }
            >
              Documents
            </SectionLabel>
            <DocumentTree workspaceId={workspaceId} activeFolderId={searchParams.get("folder")} />
          </div>
        </div>
      )}

      <WorkspaceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

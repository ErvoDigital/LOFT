import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { Home, CalendarCheck, MessageSquare, Settings, Plus, X } from "lucide-react";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import Avatar from "../common/Avatar.jsx";
import WorkspaceMark from "../common/WorkspaceMark.jsx";
import WorkspaceModal from "./WorkspaceModal.jsx";
import { NAV_GROUPS } from "./Sidebar.jsx";

// How far (px) the drawer has to be dragged left before letting go closes it.
const SWIPE_CLOSE_DISTANCE = 64;

const rowClass = ({ isActive }) =>
  `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
    isActive
      ? "bg-gradient-to-r from-brand-500/20 to-brand-500/[0.04] text-brand-700 ring-1 ring-brand-400/30 dark:from-brand-500/25 dark:to-brand-800/10 dark:text-brand-300"
      : "text-ink-600 active:bg-ink-900/[0.06] dark:text-ink-300 dark:active:bg-white/[0.06]"
  }`;

const GroupLabel = ({ children, action }) => (
  <div className="mb-1 mt-5 flex items-center justify-between px-3 first:mt-0">
    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">{children}</span>
    {action}
  </div>
);

// The phone and tablet navigation: everything the desktop rail and workspace
// panel hold, stacked into one labelled column behind the topbar's menu
// button. Rendered below the `lg` breakpoint only; the desktop Sidebar takes
// over from there.
export default function MobileNav({ open, onClose }) {
  const { workspaces } = useWorkspaces();
  const { user } = useAuth();
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const closeRef = useRef(null);
  const touch = useRef(null);

  // Focus moves into the drawer when it opens and back to whatever opened it
  // (the menu button) when it closes. Visibility is only transitioned on the
  // way out (see the panel's classes), so the panel is focusable at once.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  // Swipe left to dismiss. The drawer follows the finger, and only a mostly
  // horizontal drag counts, so scrolling the list never closes it.
  function onTouchStart(e) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, horizontal: null };
  }
  function onTouchMove(e) {
    const start = touch.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (start.horizontal === null && Math.abs(dx) + Math.abs(dy) > 8) start.horizontal = Math.abs(dx) > Math.abs(dy);
    if (start.horizontal) setDragX(Math.min(0, dx));
  }
  function onTouchEnd() {
    if (dragX < -SWIPE_CLOSE_DISTANCE) onClose();
    touch.current = null;
    setDragX(0);
  }

  const activeWorkspace = workspaces.find((w) => w.id === workspaceId);

  return (
    <div className="lg:hidden print:hidden">
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-ink-950/50 backdrop-blur-sm transition-opacity duration-300 dark:bg-ink-950/70 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={dragX ? { transform: `translateX(${dragX}px)`, transition: "none" } : undefined}
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(20rem,calc(100vw-3.5rem))] flex-col border-r border-white/60 bg-white/95 shadow-glass-lg backdrop-blur-xl duration-300 ease-out dark:border-white/[0.07] dark:bg-ink-900/95 ${
          open ? "translate-x-0 transition-transform" : "invisible -translate-x-full transition-[transform,visibility]"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-ink-900/[0.06] px-4 pt-[env(safe-area-inset-top)] dark:border-white/[0.06]">
          <div className="brand-mark flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white shadow-glow-sm">
            L
          </div>
          <span className="flex-1 text-sm font-bold tracking-[0.18em] text-ink-900 dark:text-ink-50">LOFT</span>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close navigation"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-500 transition-colors active:bg-ink-900/[0.06] dark:text-ink-300 dark:active:bg-white/[0.08]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          <div className="space-y-0.5">
            <NavLink to="/" end className={rowClass}>
              <Home className="h-[18px] w-[18px] shrink-0" /> Dashboard
            </NavLink>
            <NavLink to="/plan" className={rowClass}>
              <CalendarCheck className="h-[18px] w-[18px] shrink-0" /> My Plan
            </NavLink>
            <NavLink to="/chat" className={rowClass}>
              <MessageSquare className="h-[18px] w-[18px] shrink-0" /> Messages
            </NavLink>
          </div>

          <GroupLabel
            action={
              <button
                onClick={() => {
                  onClose();
                  setModalOpen(true);
                }}
                aria-label="Add workspace"
                className="-mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors active:bg-brand-500/10 active:text-brand-600 dark:active:text-brand-300"
              >
                <Plus className="h-4 w-4" />
              </button>
            }
          >
            Workspaces
          </GroupLabel>
          {workspaces.length === 0 && (
            <button
              onClick={() => {
                onClose();
                setModalOpen(true);
              }}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-dashed border-ink-300 px-3 text-sm font-medium text-ink-500 dark:border-white/15 dark:text-ink-400"
            >
              <Plus className="h-4 w-4" /> Create or join a workspace
            </button>
          )}
          <div className="space-y-1">
            {workspaces.map((w) => {
              const active = w.id === activeWorkspace?.id;
              return (
                <div
                  key={w.id}
                  className={active ? "rounded-2xl bg-ink-900/[0.03] p-1 ring-1 ring-ink-900/[0.06] dark:bg-white/[0.03] dark:ring-white/[0.06]" : ""}
                >
                  <NavLink
                    to={`/workspaces/${w.id}/dashboard`}
                    className={`flex min-h-[48px] items-center gap-3 rounded-xl px-2 transition-colors ${
                      active ? "" : "active:bg-ink-900/[0.06] dark:active:bg-white/[0.06]"
                    }`}
                  >
                    <WorkspaceMark
                      name={w.name}
                      color={w.color}
                      logoUrl={w.logoUrl}
                      className={`h-9 w-9 rounded-xl text-xs ${active ? "ring-2 ring-brand-400 ring-offset-2 ring-offset-white dark:ring-offset-ink-900" : ""}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{w.name}</span>
                      <span className="block truncate text-[11px] text-ink-400">
                        <span className="capitalize">{w.type}</span>
                        {w.memberCount != null && ` · ${w.memberCount} member${w.memberCount === 1 ? "" : "s"}`}
                      </span>
                    </span>
                  </NavLink>
                  {active && (
                    <div className="mt-1 pb-1">
                      {NAV_GROUPS.map((group) => (
                        <div key={group.label}>
                          <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                            {group.label}
                          </p>
                          <div className="space-y-0.5">
                            {group.items.map(({ to, label, Icon }) => (
                              <NavLink key={to} to={`/workspaces/${w.id}/${to}`} className={rowClass}>
                                <Icon className="h-[18px] w-[18px] shrink-0" /> {label}
                              </NavLink>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-ink-900/[0.06] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-white/[0.06]">
          <NavLink to="/settings" className={rowClass}>
            <Settings className="h-[18px] w-[18px] shrink-0" /> Settings
          </NavLink>
          {/* Signing out stays in the topbar's account menu. */}
          <button
            onClick={() => navigate("/profile")}
            className="mt-1 flex min-h-[52px] w-full min-w-0 items-center gap-3 rounded-xl px-2 text-left transition-colors active:bg-ink-900/[0.06] dark:active:bg-white/[0.06]"
          >
            <Avatar name={user?.name} color={user?.avatarColor} src={user?.avatarUrl} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{user?.name}</span>
              <span className="block truncate text-xs text-ink-400">{user?.email}</span>
            </span>
          </button>
        </div>
      </aside>

      <WorkspaceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

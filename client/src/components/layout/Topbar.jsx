import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Sun, Moon, Menu } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import Avatar from "../common/Avatar.jsx";
import NotificationsBell from "../notifications/NotificationsBell.jsx";

const PAGE_TITLES = {
  "/": "Dashboard",
  "/chat": "Messages",
  "/profile": "Profile",
};

export default function Topbar({ title, context, navOpen, onOpenNav }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // relative z-30: backdrop-blur makes the header its own stacking context, so
  // without a z-index the account/notification dropdowns paint under <main>,
  // which comes later in the DOM.
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/50 bg-white/60 px-2 backdrop-blur-xl dark:border-white/[0.06] dark:bg-white/[0.03] sm:px-4 lg:px-6 print:hidden">
      <div className="flex min-w-0 items-center gap-1">
        <button
          onClick={onOpenNav}
          aria-label="Open navigation"
          aria-controls="mobile-nav"
          aria-expanded={!!navOpen}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-600 transition-colors hover:bg-brand-500/10 active:bg-brand-500/15 dark:text-ink-200 dark:hover:bg-white/[0.08] lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Phones stack the workspace over the page name, since the two
            together rarely fit on one line; desktop joins them. */}
        <div className="min-w-0 lg:hidden">
          {context && <p className="truncate text-[11px] font-medium leading-tight text-ink-400">{context}</p>}
          <h1 className="truncate text-base font-semibold leading-tight tracking-tight text-ink-900 dark:text-ink-50">{title}</h1>
        </div>
        <h1 className="hidden truncate text-base font-semibold tracking-tight text-ink-900 dark:text-ink-50 lg:block">
          {context ? `${context} · ${title}` : title}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-3">
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-500 transition-all lg:h-8 lg:w-8 hover:bg-brand-500/10 hover:text-brand-600 dark:text-ink-300 dark:hover:bg-white/[0.08] dark:hover:text-brand-300"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <NotificationsBell />
        <div className="relative" ref={ref}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            title="Account menu"
            aria-label="Account menu"
            className={`ml-1 flex items-center rounded-full p-0.5 ring-2 transition-all lg:ml-0 ${
              menuOpen ? "ring-brand-400/70" : "ring-transparent hover:ring-brand-400/40"
            }`}
          >
            <Avatar name={user?.name} color={user?.avatarColor} src={user?.avatarUrl} size={30} />
          </button>
          {menuOpen && (
            <div className="dropdown-panel absolute right-0 z-20 mt-2 w-48 animate-slide-fade-in p-1.5">
              <div className="px-2.5 py-2">
                <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{user?.name}</p>
                <p className="truncate text-xs text-ink-400">{user?.email}</p>
              </div>
              <div className="my-1 h-px bg-ink-900/10 dark:bg-white/10" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/profile");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-ink-600 transition-colors hover:bg-brand-500/10 hover:text-brand-700 dark:text-ink-300 dark:hover:bg-white/[0.08] dark:hover:text-brand-300"
              >
                <User className="h-3.5 w-3.5" /> Profile settings
              </button>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export { PAGE_TITLES };

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, User, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import Avatar from "../common/Avatar.jsx";
import NotificationsBell from "../notifications/NotificationsBell.jsx";

const PAGE_TITLES = {
  "/": "Dashboard",
  "/chat": "Messages",
  "/profile": "Profile",
};

export default function Topbar({ title }) {
  const { user, logout } = useAuth();
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

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-ink-200 bg-white px-6 print:hidden">
      <h1 className="text-base font-semibold text-ink-900">{title}</h1>
      <div className="flex items-center gap-3">
        <NotificationsBell />
        <div className="relative" ref={ref}>
          <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-ink-100">
            <Avatar name={user?.name} color={user?.avatarColor} src={user?.avatarUrl} size={30} />
            <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-48 card shadow-panel p-1.5">
              <div className="px-2.5 py-2">
                <p className="truncate text-sm font-medium text-ink-800">{user?.name}</p>
                <p className="truncate text-xs text-ink-400">{user?.email}</p>
              </div>
              <div className="my-1 h-px bg-ink-100" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/profile");
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink-600 hover:bg-ink-50"
              >
                <User className="h-3.5 w-3.5" /> Profile settings
              </button>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
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

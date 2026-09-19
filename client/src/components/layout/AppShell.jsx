import { Outlet, useLocation, useParams } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import MiniCallPlayer from "../meeting/MiniCallPlayer.jsx";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";

function useTitle() {
  const location = useLocation();
  const { workspaceId } = useParams();
  const { workspaces } = useWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);

  if (location.pathname === "/") return "Dashboard";
  if (location.pathname.startsWith("/plan")) return "My Plan";
  if (location.pathname.startsWith("/chat")) return "Messages";
  if (location.pathname.startsWith("/profile")) return "Profile";
  if (location.pathname.startsWith("/settings")) return "Settings";
  if (workspace) {
    if (location.pathname.endsWith("/dashboard")) return `${workspace.name} · Overview`;
    if (location.pathname.endsWith("/calendar")) return `${workspace.name} · Calendar`;
    if (location.pathname.endsWith("/tasks")) return `${workspace.name} · Tasks`;
    if (location.pathname.endsWith("/chat")) return `${workspace.name} · Chat`;
    if (location.pathname.endsWith("/meeting")) return `${workspace.name} · Meeting`;
    if (location.pathname.endsWith("/storage")) return `${workspace.name} · Storage`;
    if (location.pathname.endsWith("/settings")) return `${workspace.name} · Settings`;
    return workspace.name;
  }
  return "LOFT";
}

export default function AppShell() {
  const title = useTitle();

  return (
    <div className="relative flex h-screen overflow-hidden">
      {/* The colour the frosted panels blur against — without it the glass
          surfaces read as flat translucent grey. */}
      <div className="app-backdrop pointer-events-none fixed inset-0 -z-10 print:hidden" aria-hidden="true" />
      <Sidebar />
      {/* Framed content column — the layered, floating-panel look the rail and
          workspace panel share. No background of its own, so the page keeps
          blurring against the backdrop rather than stacking another layer. */}
      <div className="relative my-2 mr-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/60 shadow-glass dark:border-white/[0.07] print:m-0 print:rounded-none print:border-0">
        <Topbar title={title} />
        <main className="relative flex-1 overflow-y-auto print:overflow-visible">
          <Outlet />
        </main>
        <MiniCallPlayer />
      </div>
    </div>
  );
}

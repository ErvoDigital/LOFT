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
  if (location.pathname.startsWith("/chat")) return "Messages";
  if (location.pathname.startsWith("/profile")) return "Profile";
  if (workspace) {
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
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto print:overflow-visible">
          <Outlet />
        </main>
        <MiniCallPlayer />
      </div>
    </div>
  );
}

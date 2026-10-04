import { Outlet, useLocation, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "./Sidebar.jsx";
import MobileNav from "./MobileNav.jsx";
import Topbar from "./Topbar.jsx";
import MiniCallPlayer from "../meeting/MiniCallPlayer.jsx";
import AssistantWidget from "../assistant/AssistantWidget.jsx";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";

// The page name, plus the workspace it belongs to when there is one. The
// desktop topbar joins them on one line; the phone topbar stacks them.
function useTitle() {
  const location = useLocation();
  const { workspaceId } = useParams();
  const { workspaces } = useWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);

  if (location.pathname === "/") return { title: "Dashboard" };
  if (location.pathname.startsWith("/plan")) return { title: "My Plan" };
  if (location.pathname.startsWith("/chat")) return { title: "Messages" };
  if (location.pathname.startsWith("/profile")) return { title: "Profile" };
  if (location.pathname.startsWith("/settings")) return { title: "Settings" };
  if (workspace) {
    const context = workspace.name;
    if (location.pathname.endsWith("/dashboard")) return { context, title: "Overview" };
    if (location.pathname.endsWith("/calendar")) return { context, title: "Calendar" };
    if (location.pathname.endsWith("/tasks")) return { context, title: "Tasks" };
    if (location.pathname.endsWith("/chat")) return { context, title: "Chat" };
    if (location.pathname.endsWith("/meeting")) return { context, title: "Meeting" };
    if (location.pathname.endsWith("/storage")) return { context, title: "Storage" };
    if (location.pathname.endsWith("/settings")) return { context, title: "Settings" };
    if (location.pathname.includes("/docs")) return { context, title: "Docs" };
    return { title: workspace.name };
  }
  return { title: "LOFT" };
}

export default function AppShell() {
  const { title, context } = useTitle();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  // Picking a destination in the drawer navigates, and navigating closes it.
  useEffect(() => setNavOpen(false), [location.pathname, location.search]);

  // Widening past the drawer breakpoint swaps in the desktop sidebar, so an
  // open drawer shouldn't reappear the next time the window narrows.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onChange = (e) => e.matches && setNavOpen(false);
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  // h-dvh after h-screen: mobile browsers size 100vh as if their toolbars were
  // hidden, which pushes the bottom of the app under them. Browsers without
  // dvh drop that declaration and keep h-screen.
  return (
    <div className="relative flex h-screen h-dvh overflow-hidden">
      {/* The colour the frosted panels blur against — without it the glass
          surfaces read as flat translucent grey. */}
      <div className="app-backdrop pointer-events-none fixed inset-0 -z-10 print:hidden" aria-hidden="true" />
      <Sidebar />
      <MobileNav open={navOpen} onClose={closeNav} />
      {/* Framed content column — the layered, floating-panel look the rail and
          workspace panel share. No background of its own, so the page keeps
          blurring against the backdrop rather than stacking another layer.
          Phones and tablets get it edge to edge, with no frame. */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden lg:my-2 lg:mr-2 lg:rounded-2xl lg:border lg:border-white/60 lg:shadow-glass lg:dark:border-white/[0.07] print:m-0 print:rounded-none print:border-0">
        <Topbar title={title} context={context} navOpen={navOpen} onOpenNav={() => setNavOpen(true)} />
        <main className="relative flex-1 overflow-y-auto overscroll-contain print:overflow-visible">
          <Outlet />
        </main>
        <MiniCallPlayer />
        <AssistantWidget />
      </div>
    </div>
  );
}

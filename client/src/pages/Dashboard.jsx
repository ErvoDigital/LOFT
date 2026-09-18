import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import * as dashboardApi from "../api/dashboard.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { useWorkspaces } from "../context/WorkspaceContext.jsx";
import ConflictsPanel from "../components/dashboard/ConflictsPanel.jsx";
import UpcomingEvents from "../components/dashboard/UpcomingEvents.jsx";
import PendingTasksPanel from "../components/dashboard/PendingTasksPanel.jsx";
import ActivityFeed from "../components/dashboard/ActivityFeed.jsx";
import StatCard from "../components/dashboard/StatCard.jsx";
import RecentFilesPanel from "../components/dashboard/RecentFilesPanel.jsx";
import Spinner from "../components/common/Spinner.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import WorkspaceModal from "../components/layout/WorkspaceModal.jsx";
import { displayColor, textOn } from "../lib/colors.js";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { workspaces } = useWorkspaces();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(() => {
    dashboardApi.getDashboard().then(setData).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const events = [
      "task:created",
      "task:updated",
      "task:deleted",
      "event:created",
      "event:updated",
      "event:cancelled",
      "notification:new",
    ];
    const handler = () => load();
    events.forEach((e) => socket.on(e, handler));
    return () => events.forEach((e) => socket.off(e, handler));
  }, [socket, load]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-10">
        <EmptyState
          icon={<Home className="h-5 w-5" />}
          title="Welcome to LOFT"
          description="Create your first workspace — a class, a job, an org, a team — or join one with an invite code to bring it into your dashboard."
          action={
            <button className="btn-primary" onClick={() => setModalOpen(true)}>
              Add your first workspace
            </button>
          }
        />
        <WorkspaceModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    );
  }

  const tasksDueToday = data?.pendingTasks?.filter((t) => t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()).length || 0;
  const eventsToday = data?.upcomingEvents?.filter((e) => new Date(e.startTime).toDateString() === new Date().toDateString()).length || 0;

  const pendingCount = data?.pendingTasks?.length || 0;
  const conflictCount = data?.conflicts?.length || 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">
          {greeting()}, {user?.name?.split(" ")[0]}
        </h2>
        <p className="text-sm text-ink-500">
          Everything across your {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}, in one place.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Workspaces"
          value={workspaces.length}
          trend={`${data?.recentActivity?.length || 0} recent updates`}
        />
        <StatCard
          label="Tasks due today"
          value={tasksDueToday}
          tone={tasksDueToday > 0 ? "brand" : "default"}
          trend={`${pendingCount} pending overall`}
        />
        <StatCard
          label="Meetings today"
          value={eventsToday}
          trend={`${data?.upcomingEvents?.length || 0} in next 14 days`}
        />
        <StatCard
          label="Conflicts found"
          value={conflictCount}
          tone={conflictCount > 0 ? "danger" : "positive"}
          trend={conflictCount > 0 ? "Needs resolving" : "Nothing clashing"}
        />
      </div>

      <section>
        <h3 className="section-label mb-2">Cross-workspace conflicts</h3>
        <ConflictsPanel conflicts={data?.conflicts} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">Upcoming meetings</h3>
            <span className="text-xs text-ink-400">Next 14 days</span>
          </div>
          <UpcomingEvents events={data?.upcomingEvents} />
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">Your pending tasks</h3>
            <Link to="/plan" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
              View my plan
            </Link>
          </div>
          <PendingTasksPanel tasks={data?.pendingTasks} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink-800 dark:text-ink-100">Recent activity</h3>
          <ActivityFeed activity={data?.recentActivity} />
        </section>

        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink-800 dark:text-ink-100">Documents &amp; files</h3>
          <RecentFilesPanel files={data?.recentFiles} />
        </section>
      </div>

      <section>
        <h3 className="section-label mb-2">Your workspaces</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {workspaces.map((w) => (
            <Link key={w.id} to={`/workspaces/${w.id}/dashboard`} className="card card-hover flex items-center gap-3 p-3">
              <div
                style={{ backgroundColor: displayColor(w.color), color: textOn(w.color) }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
              >
                {w.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{w.name}</p>
                <p className="text-xs capitalize text-ink-400">{w.memberCount} member{w.memberCount === 1 ? "" : "s"}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}


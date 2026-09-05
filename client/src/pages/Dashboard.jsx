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
import Spinner from "../components/common/Spinner.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import WorkspaceModal from "../components/layout/WorkspaceModal.jsx";

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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold text-ink-900">
          {greeting()}, {user?.name?.split(" ")[0]}
        </h2>
        <p className="text-sm text-ink-500">
          Everything across your {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}, in one place.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip label="Workspaces" value={workspaces.length} />
        <StatChip label="Tasks due today" value={tasksDueToday} accent={tasksDueToday > 0} />
        <StatChip label="Meetings today" value={eventsToday} />
        <StatChip label="Conflicts found" value={data?.conflicts?.length || 0} accent={(data?.conflicts?.length || 0) > 0} danger />
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Cross-workspace conflicts</h3>
        <ConflictsPanel conflicts={data?.conflicts} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-800">Upcoming meetings</h3>
            <span className="text-xs text-ink-400">Next 14 days</span>
          </div>
          <UpcomingEvents events={data?.upcomingEvents} />
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-800">Your pending tasks</h3>
            <span className="text-xs text-ink-400">Across all workspaces</span>
          </div>
          <PendingTasksPanel tasks={data?.pendingTasks} />
        </section>
      </div>

      <section className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink-800">Recent activity</h3>
        <ActivityFeed activity={data?.recentActivity} />
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Your workspaces</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {workspaces.map((w) => (
            <Link key={w.id} to={`/workspaces/${w.id}/calendar`} className="card flex items-center gap-3 p-3 transition-shadow hover:shadow-panel">
              <div
                style={{ backgroundColor: w.color }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
              >
                {w.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-800">{w.name}</p>
                <p className="text-xs capitalize text-ink-400">{w.memberCount} member{w.memberCount === 1 ? "" : "s"}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatChip({ label, value, accent, danger }) {
  return (
    <div className="card p-4">
      <p className={`text-2xl font-semibold ${accent ? (danger ? "text-red-600" : "text-brand-600") : "text-ink-900"}`}>{value}</p>
      <p className="text-xs font-medium text-ink-500">{label}</p>
    </div>
  );
}

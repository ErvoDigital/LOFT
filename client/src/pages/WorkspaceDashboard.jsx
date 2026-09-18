import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckSquare, CalendarPlus } from "lucide-react";
import * as workspacesApi from "../api/workspaces.js";
import { useSocket } from "../context/SocketContext.jsx";
import { useWorkspaces } from "../context/WorkspaceContext.jsx";
import StatCard from "../components/dashboard/StatCard.jsx";
import ScheduleStrip from "../components/dashboard/ScheduleStrip.jsx";
import MeetingSummaryPanel from "../components/dashboard/MeetingSummaryPanel.jsx";
import RecentFilesPanel from "../components/dashboard/RecentFilesPanel.jsx";
import ActivityFeed from "../components/dashboard/ActivityFeed.jsx";
import TaskCard from "../components/tasks/TaskCard.jsx";
import ScheduleMeetingModal from "../components/meeting/ScheduleMeetingModal.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Spinner from "../components/common/Spinner.jsx";

const RELOAD_EVENTS = [
  "task:created",
  "task:updated",
  "task:deleted",
  "taskStatus:created",
  "taskStatus:updated",
  "taskStatus:deleted",
  "event:created",
  "event:updated",
  "event:cancelled",
  "asset:created",
  "asset:updated",
  "asset:merged",
  "asset:deleted",
];

export default function WorkspaceDashboard() {
  const { workspaceId } = useParams();
  const { socket } = useSocket();
  const { workspaces } = useWorkspaces();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const workspace = workspaces.find((w) => w.id === workspaceId);

  const load = useCallback(() => {
    workspacesApi.getWorkspaceDashboard(workspaceId).then(setData).finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => load();
    RELOAD_EVENTS.forEach((e) => socket.on(e, handler));
    return () => RELOAD_EVENTS.forEach((e) => socket.off(e, handler));
  }, [socket, load]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const summary = data?.tasksSummary || {};
  const completionRate = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
            {workspace?.name || "Workspace"}
          </h2>
          <p className="text-sm text-ink-500">
            {summary.pending || 0} open task{summary.pending === 1 ? "" : "s"} ·{" "}
            {data?.upcomingEvents?.length || 0} event{data?.upcomingEvents?.length === 1 ? "" : "s"} this week
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link to={`/workspaces/${workspaceId}/calendar`} className="btn-secondary">
            <CalendarPlus className="h-4 w-4" /> Schedule
          </Link>
          <Link to={`/workspaces/${workspaceId}/tasks`} className="btn-primary">
            <CheckSquare className="h-4 w-4" /> Open board
          </Link>
        </div>
      </div>

      {/* relative z-10: the day task list pops out over the stat cards below,
          which are later in the DOM and their own blur stacking contexts. */}
      <section className="card relative z-10 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-label">This week</h3>
          <Link
            to={`/workspaces/${workspaceId}/calendar`}
            className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
          >
            Full calendar
          </Link>
        </div>
        <ScheduleStrip
          events={data?.upcomingEvents}
          tasks={data?.weekTasks}
          workspaceId={workspaceId}
          accentColor={workspace?.color}
        />
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Tasks completed"
          value={summary.done || 0}
          tone="positive"
          trend={`${completionRate}% of all tasks`}
        />
        <StatCard label="Tasks pending" value={summary.pending || 0} tone="brand" trend="Across the board" />
        <StatCard
          label="Due today"
          value={summary.dueToday || 0}
          tone={summary.dueToday > 0 ? "brand" : "default"}
          trend={summary.dueToday > 0 ? "Needs attention" : "Nothing due"}
        />
        <StatCard
          label="Overdue"
          value={summary.overdue || 0}
          tone={summary.overdue > 0 ? "danger" : "default"}
          trend={summary.overdue > 0 ? "Past due date" : "All on track"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">Tasks due soon</h3>
            <Link
              to={`/workspaces/${workspaceId}/tasks`}
              className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
            >
              View board
            </Link>
          </div>
          {data?.tasksDueSoon?.length ? (
            <div className="space-y-2">
              {data.tasksDueSoon.map((t) => (
                <Link key={t.id} to={`/workspaces/${workspaceId}/tasks`} className="block">
                  <TaskCard task={t} draggable={false} onClick={() => {}} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<CheckSquare className="h-5 w-5" />}
              title="Nothing due soon"
              description="Tasks with upcoming due dates will appear here."
            />
          )}
        </section>

        <section className="card self-start p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink-800 dark:text-ink-100">Meeting</h3>
          <MeetingSummaryPanel
            workspaceId={workspaceId}
            upcomingEvents={data?.upcomingEvents}
            onSchedule={() => setScheduleOpen(true)}
          />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink-800 dark:text-ink-100">Team activity</h3>
          <ActivityFeed activity={data?.recentActivity} showWorkspace={false} />
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">Recent files</h3>
            <Link
              to={`/workspaces/${workspaceId}/storage`}
              className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
            >
              All files
            </Link>
          </div>
          <RecentFilesPanel files={data?.recentFiles} showWorkspace={false} workspaceId={workspaceId} />
        </section>
      </div>

      <ScheduleMeetingModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        workspaceId={workspaceId}
        meetLink={`${window.location.origin}/workspaces/${workspaceId}/meeting`}
      />
    </div>
  );
}

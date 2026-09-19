import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as workspacesApi from "../api/workspaces.js";
import { useSocket } from "../context/SocketContext.jsx";
import { useWorkspaces } from "../context/WorkspaceContext.jsx";
import WorkspaceHero from "../components/dashboard/WorkspaceHero.jsx";
import WeekBoard from "../components/dashboard/WeekBoard.jsx";
import TaskQueue from "../components/dashboard/TaskQueue.jsx";
import MeetingSummaryPanel from "../components/dashboard/MeetingSummaryPanel.jsx";
import RecentFilesPanel from "../components/dashboard/RecentFilesPanel.jsx";
import ActivityFeed from "../components/dashboard/ActivityFeed.jsx";
import { buildFortnight } from "../components/dashboard/fortnight.js";
import ScheduleMeetingModal from "../components/meeting/ScheduleMeetingModal.jsx";
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

function CardHeader({ title, to, linkLabel }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">{title}</h3>
      {to && (
        <Link to={to} className="shrink-0 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

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

  // Sorted here so each day lists its events in time order, and the hero's
  // "next" really is the next one.
  const week = useMemo(() => {
    const events = [...(data?.upcomingEvents || [])].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    return buildFortnight({ events, tasks: data?.weekTasks, length: 7 });
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const summary = data?.tasksSummary || {};

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <WorkspaceHero workspace={workspace} workspaceId={workspaceId} summary={summary} days={week} />

      {/* Full width at every size. At 2xl a side rail splits off for the
          meeting room and files; each column is as tall as its own content,
          so a long list on one side never stretches the other. */}
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:items-start min-[1800px]:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <WeekBoard days={week} workspaceId={workspaceId} accentColor={workspace?.color} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <TaskQueue tasks={data?.tasksDueSoon} openCount={summary.pending} workspaceId={workspaceId} />

            <section className="card p-5">
              <CardHeader title="Team chat" to={`/workspaces/${workspaceId}/chat`} linkLabel="Open chat" />
              <ActivityFeed
                activity={data?.recentActivity}
                showWorkspace={false}
                emptyDescription="The latest messages in this workspace's channels show up here."
              />
            </section>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-1">
          <section className="card p-5">
            <CardHeader title="Meeting room" />
            <MeetingSummaryPanel
              workspaceId={workspaceId}
              upcomingEvents={data?.upcomingEvents}
              onSchedule={() => setScheduleOpen(true)}
            />
          </section>

          <section className="card p-5">
            <CardHeader title="Recent files" to={`/workspaces/${workspaceId}/storage`} linkLabel="All files" />
            <RecentFilesPanel files={data?.recentFiles} showWorkspace={false} workspaceId={workspaceId} />
          </section>
        </div>
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

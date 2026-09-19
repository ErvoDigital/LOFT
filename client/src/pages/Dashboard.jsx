import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlarmClock, CalendarClock, ListChecks, Plus, ShieldCheck, Video } from "lucide-react";
import * as dashboardApi from "../api/dashboard.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { useWorkspaces } from "../context/WorkspaceContext.jsx";
import ConflictsPanel from "../components/dashboard/ConflictsPanel.jsx";
import FortnightSkyline from "../components/dashboard/FortnightSkyline.jsx";
import AgendaPanel from "../components/dashboard/AgendaPanel.jsx";
import MetricStrip from "../components/dashboard/MetricStrip.jsx";
import PendingTasksPanel from "../components/dashboard/PendingTasksPanel.jsx";
import ActivityFeed from "../components/dashboard/ActivityFeed.jsx";
import RecentFilesPanel from "../components/dashboard/RecentFilesPanel.jsx";
import WorkspaceList from "../components/dashboard/WorkspaceList.jsx";
import CustomizableDashboard from "../components/dashboard/CustomizableDashboard.jsx";
import { buildFortnight, countPhrase, dayName, startOfDay } from "../components/dashboard/fortnight.js";
import Spinner from "../components/common/Spinner.jsx";
import WorkspaceModal from "../components/layout/WorkspaceModal.jsx";

// The server caps the pending-task list; past it the count is a floor.
const PENDING_TASK_CAP = 50;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function shortDate(value) {
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

function timeOf(value) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Greeting({ firstName }) {
  return (
    <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-white sm:text-[2.125rem]">
      <span className="font-normal text-brand-100">
        {greeting()}
        {firstName ? "," : ""}
      </span>{" "}
      {firstName}
    </h2>
  );
}

function summarize(days) {
  const load = (d) => d.meetings.length + d.deadlines.length;
  const meetings = days.reduce((n, d) => n + d.meetings.length, 0);
  const deadlines = days.reduce((n, d) => n + d.deadlines.length, 0);
  if (!meetings && !deadlines) return "Nothing scheduled and nothing due over the next two weeks.";

  const lead = `${countPhrase(meetings, "meeting")} and ${countPhrase(deadlines, "deadline")} over the next two weeks`;
  const busiest = days.reduce((best, d) => (load(d) > load(best) ? d : best), days[0]);
  let tail = "";
  if (load(busiest) >= 2) {
    tail = busiest.index < 2 ? `, busiest ${dayName(busiest).toLowerCase()}` : `, busiest on ${dayName(busiest)}`;
  }
  return `${lead.charAt(0).toUpperCase()}${lead.slice(1)}${tail}.`;
}

function ClashStatus({ count, onReview }) {
  if (!count) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/15">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-300" />
        No clashes in the next 14 days
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onReview}
      className="inline-flex items-center gap-2 rounded-full bg-accent-400/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-accent-300/50 transition-colors hover:bg-accent-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75 motion-reduce:hidden" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-400" />
      </span>
      {count} {count === 1 ? "clash" : "clashes"} to resolve
    </button>
  );
}

const CLASHES_ID = "dashboard-clashes";

// The greeting and the two-week strip. Laid out against its own width rather
// than the screen's, since it can be resized: side by side once it's 54rem
// wide, stacked below that.
function OverviewPanel({ firstName, workspaceCount, days, conflictCount, onReviewConflicts, selectedDay, onSelectDay }) {
  return (
    <section className="hero-panel h-full p-5 @container sm:p-7">
      <div className="flex flex-col gap-6 @[54rem]:flex-row @[54rem]:gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3 @[54rem]:w-[18rem] @[54rem]:shrink-0 @[54rem]:flex-col @[54rem]:flex-nowrap @[54rem]:items-start @6xl:w-[21rem]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-100">
            {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
            <span className="text-brand-100/60"> · </span>
            {workspaceCount} workspace{workspaceCount === 1 ? "" : "s"}
          </p>
          <div className="@[54rem]:order-last @[54rem]:mt-auto">
            <ClashStatus count={conflictCount} onReview={onReviewConflicts} />
          </div>
          <div className="mt-1 w-full">
            <Greeting firstName={firstName} />
            <p className="mt-1.5 max-w-xl text-sm text-brand-100 sm:text-[15px]">{summarize(days)}</p>
          </div>
        </div>
        <div className="min-w-0 @[54rem]:flex-1">
          <FortnightSkyline days={days} selectedKey={selectedDay} onSelect={onSelectDay} />
        </div>
      </div>
    </section>
  );
}

function ClashesPanel({ conflicts, editing }) {
  if (!conflicts?.length) {
    // Only drawn while editing the layout; otherwise the widget is left out
    // until there's a clash to show.
    return (
      <section className="card flex items-center gap-3 border-dashed p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-800 dark:text-ink-100">No clashes right now</p>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
            This spot stays out of the way until two things collide, then it opens here.
          </p>
        </div>
      </section>
    );
  }
  return (
    // No card padding of its own, so while editing it makes room for the
    // frame's chips above the heading.
    <section id={CLASHES_ID} className={`scroll-mt-6 @container ${editing ? "pt-4" : ""}`}>
      <h3 className="section-label mb-2">Clashes across workspaces</h3>
      <ConflictsPanel conflicts={conflicts} listClassName="grid grid-cols-1 gap-2 @3xl:grid-cols-2" />
    </section>
  );
}

// A titled card whose body scrolls when the dashboard gives it less height
// than its content.
function ListPanel({ title, subtitle, action, children }) {
  return (
    <section className="card flex h-full flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="dash-scroll -mx-2 min-h-0 flex-1 overflow-y-auto px-2">{children}</div>
    </section>
  );
}

function buildMetrics({ today, pendingTasks, upcomingEvents }) {
  const startOfToday = startOfDay(new Date());
  const dueToday = today.deadlines;
  const meetingsToday = today.meetings;
  const overdue = pendingTasks
    .filter((t) => t.dueDate && new Date(t.dueDate) < startOfToday)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const critical = pendingTasks.filter((t) => t.tier === "TIER_1").length;
  const nextMeeting = upcomingEvents[0];
  const meetingToShow = meetingsToday[0] || nextMeeting;

  return [
    {
      label: "Due today",
      icon: CalendarClock,
      value: dueToday.length,
      to: "/plan",
      detail:
        dueToday.length === 0
          ? "Nothing due today"
          : dueToday.length === 1
            ? dueToday[0].title
            : `${dueToday[0].title} and ${dueToday.length - 1} more`,
    },
    {
      label: "Overdue",
      icon: AlarmClock,
      value: overdue.length,
      tone: overdue.length ? "danger" : "default",
      to: "/plan",
      detail: overdue.length ? `Oldest was due ${shortDate(overdue[0].dueDate)}` : "All on track",
    },
    {
      label: "Meetings today",
      icon: Video,
      value: meetingsToday.length,
      to: meetingToShow ? `/workspaces/${meetingToShow.workspaceId}/calendar` : null,
      detail: meetingsToday.length
        ? `Next at ${timeOf(meetingsToday[0].startTime)} · ${meetingsToday[0].title}`
        : nextMeeting
          ? `Next on ${shortDate(nextMeeting.startTime)} · ${nextMeeting.title}`
          : "None in the next two weeks",
    },
    {
      label: "Open tasks",
      icon: ListChecks,
      value: pendingTasks.length >= PENDING_TASK_CAP ? `${PENDING_TASK_CAP}+` : pendingTasks.length,
      to: "/plan",
      detail: critical
        ? `${critical} critical (Tier 1)`
        : pendingTasks.length
          ? "None critical"
          : "Nothing assigned to you",
    },
  ];
}

export default function Dashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { workspaces } = useWorkspaces();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const navigate = useNavigate();

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

  const days = useMemo(
    () =>
      buildFortnight({
        events: data?.upcomingEvents,
        tasks: data?.pendingTasks,
        conflicts: data?.conflicts,
      }),
    [data]
  );

  // Events arrive without their workspace's color, so it's looked up here.
  const colorById = useMemo(() => new Map(workspaces.map((w) => [w.id, w.color])), [workspaces]);
  const colorFor = useCallback((item) => item.workspaceColor || colorById.get(item.workspaceId), [colorById]);

  const { openTasksById, meetingsById } = useMemo(() => {
    const tally = (list) =>
      (list || []).reduce((m, x) => m.set(x.workspaceId, (m.get(x.workspaceId) || 0) + 1), new Map());
    return { openTasksById: tally(data?.pendingTasks), meetingsById: tally(data?.upcomingEvents) };
  }, [data]);

  const firstName = user?.name?.split(" ")[0];
  const conflictCount = data?.conflicts?.length || 0;

  // The Clashes widget only takes up room when there's a clash, except while
  // the layout is being edited, so it can still be placed.
  const isAvailable = useCallback((id, editing) => id !== "clashes" || editing || conflictCount > 0, [conflictCount]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <section className="hero-panel px-6 py-10 sm:px-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-100">Welcome to LOFT</p>
          <div className="mt-3">
            <Greeting firstName={firstName} />
          </div>
          <p className="mt-2 max-w-lg text-sm text-brand-100 sm:text-[15px]">
            Add a class, a job, an org or a team, or join one with an invite code. Everything from each one lands
            here, and LOFT flags the places where they clash.
          </p>
          <button
            className="btn mt-6 bg-white text-brand-800 shadow-glass hover:bg-brand-50"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add your first workspace
          </button>
        </section>
        <WorkspaceModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    );
  }

  const metrics = buildMetrics({
    today: days[0],
    pendingTasks: data?.pendingTasks || [],
    upcomingEvents: data?.upcomingEvents || [],
  });

  // With the Clashes widget switched off, My Plan is where clashes are listed.
  const reviewConflicts = () => {
    const panel = document.getElementById(CLASHES_ID);
    if (!panel) {
      navigate("/plan");
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const renderWidget = (id, editing) => {
    switch (id) {
      case "overview":
        return (
          <OverviewPanel
            firstName={firstName}
            workspaceCount={workspaces.length}
            days={days}
            conflictCount={conflictCount}
            onReviewConflicts={reviewConflicts}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        );
      case "metrics":
        return <MetricStrip metrics={metrics} />;
      case "clashes":
        return <ClashesPanel conflicts={data?.conflicts} editing={editing} />;
      case "agenda":
        return (
          <AgendaPanel days={days} selectedKey={selectedDay} onShowAll={() => setSelectedDay(null)} colorFor={colorFor} />
        );
      case "priorities":
        return (
          <ListPanel
            title="Your priorities"
            subtitle="Assigned to you, most urgent tier first"
            action={
              <Link to="/plan" className="shrink-0 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
                View my plan
              </Link>
            }
          >
            <PendingTasksPanel tasks={data?.pendingTasks} />
          </ListPanel>
        );
      case "workspaces":
        return (
          <WorkspaceList
            workspaces={workspaces}
            openTasksById={openTasksById}
            meetingsById={meetingsById}
            onAdd={() => setModalOpen(true)}
          />
        );
      case "activity":
        return (
          <ListPanel title="Recent activity">
            <ActivityFeed activity={data?.recentActivity} />
          </ListPanel>
        );
      case "files":
        return (
          <ListPanel title="Documents & files">
            <RecentFilesPanel files={data?.recentFiles} />
          </ListPanel>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <CustomizableDashboard key={user?.id} userId={user?.id} render={renderWidget} isAvailable={isAvailable} />
      <WorkspaceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

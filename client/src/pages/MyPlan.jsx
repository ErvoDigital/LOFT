import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarCheck, ListChecks, CalendarDays } from "lucide-react";
import * as planApi from "../api/plan.js";
import * as tasksApi from "../api/tasks.js";
import * as workspacesApi from "../api/workspaces.js";
import * as taskStatusesApi from "../api/taskStatuses.js";
import { useSocket } from "../context/SocketContext.jsx";
import AtRiskPanel from "../components/plan/AtRiskPanel.jsx";
import ConflictsPanel from "../components/dashboard/ConflictsPanel.jsx";
import PlanDayGroup from "../components/plan/PlanDayGroup.jsx";
import PlanCalendar from "../components/plan/PlanCalendar.jsx";
import TaskModal from "../components/tasks/TaskModal.jsx";
import TaskDetailsPanel from "../components/tasks/TaskDetailsPanel.jsx";
import { TierBadge } from "../components/common/Badges.jsx";
import Spinner from "../components/common/Spinner.jsx";
import EmptyState from "../components/common/EmptyState.jsx";

const CAPACITY_KEY = "loft:plan-capacity";
const CAPACITY_OPTIONS = [2, 4, 6, 8, 10];

export default function MyPlan() {
  const { socket } = useSocket();
  const [view, setView] = useState("schedule"); // "schedule" | "calendar"
  const [capacity, setCapacity] = useState(() => {
    const stored = Number(localStorage.getItem(CAPACITY_KEY));
    return CAPACITY_OPTIONS.includes(stored) ? stored : 6;
  });
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null); // { workspaceId, members, statuses, task }
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const requestId = useRef(0);

  // Two loads can overlap (e.g. a tier edit's reload racing a capacity
  // change fired right after it) — only the most recently issued response is
  // allowed to land, so a slow, now-stale request can't clobber a fresher one.
  const load = useCallback((cap) => {
    const id = ++requestId.current;
    planApi.getPlan(cap).then((data) => {
      if (id === requestId.current) setPlan(data);
    }).finally(() => {
      if (id === requestId.current) setLoading(false);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    load(capacity);
    try {
      localStorage.setItem(CAPACITY_KEY, String(capacity));
    } catch {
      // localStorage unavailable — capacity just won't persist.
    }
  }, [capacity, load]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => load(capacity);
    const socketEvents = ["task:created", "task:updated", "task:deleted", "event:created", "event:updated", "event:cancelled"];
    socketEvents.forEach((e) => socket.on(e, handler));
    return () => socketEvents.forEach((e) => socket.off(e, handler));
  }, [socket, load, capacity]);

  // Shared by the status select and the pin/snooze toggles: patch the item
  // in-place everywhere it appears (today's schedule and the flat task
  // list) for an instant-feeling UI, persist it, then re-run the Smart
  // Priority Engine server-side since a pin/snooze change can reshuffle the
  // whole day-by-day order, not just the one row.
  async function patchItem(item, patch) {
    setPlan((prev) =>
      prev && {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === item.taskId ? { ...t, ...patch } : t)),
        days: prev.days.map((d) => ({
          ...d,
          items: d.items.map((it) => (it.taskId === item.taskId ? { ...it, ...patch } : it)),
        })),
      }
    );
    await tasksApi.updateTask(item.workspaceId, item.taskId, patch);
    load(capacity);
  }

  const handleStatusChange = (item, status) => patchItem(item, { status });
  const handleTogglePin = (item) => patchItem(item, { isPinned: !item.isPinned });
  const handleToggleSnooze = (item) => patchItem(item, { isSnoozed: !item.isSnoozed });

  // Opens the read-only details panel, the same one the workspace Tasks
  // board uses — actually editing is a deliberate follow-up step from there
  // (its pencil icon), not the click itself. My Plan's rows only carry a
  // summarized task shape (no description/assignee), so the full record
  // plus that workspace's members/statuses are fetched fresh — this is what
  // makes a task "clickable to show details" from a cross-workspace view
  // without duplicating TaskModal's form logic.
  async function openTaskDetail(item) {
    const workspaceId = item.workspaceId;
    const taskId = item.taskId || item.id;
    setDetailLoading(true);
    try {
      const [workspace, statuses, tasks] = await Promise.all([
        workspacesApi.getWorkspace(workspaceId),
        taskStatusesApi.listTaskStatuses(workspaceId),
        tasksApi.listWorkspaceTasks(workspaceId),
      ]);
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setDetail({ workspaceId, members: workspace.members, statuses, task });
        setDetailsOpen(true);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const criticalCount = plan?.tasks?.filter((t) => t.tier === "TIER_1").length || 0;
  const today = plan?.days?.find((d) => d.isToday);
  const hasTasks = plan?.tasks?.length > 0;
  const hasConflicts = plan?.conflicts?.length > 0;

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-ink-900">My Plan</h2>
            <p className="text-sm text-ink-500">Every open task across your workspaces, ranked by Smart Priority into a day-by-day plan.</p>
            {view === "schedule" && (
              <label className="mt-2 flex items-center gap-2 text-sm text-ink-600">
                Hours per day
                <select className="input !w-auto" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
                  {CAPACITY_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h}h
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-lg bg-ink-100 p-1 text-sm">
            <button
              onClick={() => setView("schedule")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                view === "schedule" ? "bg-white text-ink-800 shadow-soft" : "text-ink-500"
              }`}
            >
              <ListChecks className="h-4 w-4" /> Schedule
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                view === "calendar" ? "bg-white text-ink-800 shadow-soft" : "text-ink-500"
              }`}
            >
              <CalendarDays className="h-4 w-4" /> Calendar
            </button>
          </div>
        </div>

        {!hasTasks && !hasConflicts ? (
          <EmptyState
            icon={<CalendarCheck className="h-5 w-5" />}
            title="Nothing to plan yet"
            description="Tasks assigned to you across every workspace will show up here, ranked and sorted into a day-by-day plan."
          />
        ) : (
          <>
            {hasTasks && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatChip label="Open tasks" value={plan.tasks.length} />
                <StatChip label="Critical (Tier 1)" value={criticalCount} accent={criticalCount > 0} danger />
                <StatChip label="Planned today" value={`${today?.plannedHours || 0}h`} />
                <StatChip label="At risk" value={plan.atRisk.length} accent={plan.atRisk.length > 0} danger />
              </div>
            )}

            {hasConflicts && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Cross-workspace conflicts</h3>
                <ConflictsPanel conflicts={plan.conflicts} />
              </section>
            )}

            {hasTasks && (
              <>
                <AtRiskPanel items={plan.atRisk} />

                {view === "schedule" ? (
                  <section className="space-y-3">
                    {plan.days.map((day) => (
                      <PlanDayGroup
                        key={day.date}
                        day={day}
                        statusesByWorkspace={plan.statusesByWorkspace}
                        onStatusChange={handleStatusChange}
                        onTogglePin={handleTogglePin}
                        onToggleSnooze={handleToggleSnooze}
                        onTaskClick={openTaskDetail}
                      />
                    ))}
                  </section>
                ) : (
                  <PlanCalendar tasks={plan.tasks} onTaskClick={openTaskDetail} />
                )}

                {plan.unscheduled.length > 0 && (
                  <section className="card p-4">
                    <h4 className="mb-2 text-sm font-semibold text-ink-800">Someday</h4>
                    <p className="mb-2 text-xs text-ink-400">No due date, and no room in the next 30 days at this pace.</p>
                    <div className="space-y-1.5">
                      {plan.unscheduled.map((t) => (
                        <button
                          key={t.taskId}
                          onClick={() => openTaskDetail(t)}
                          className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-ink-50"
                        >
                          <TierBadge tier={t.tier} compact />
                          <p className="truncate text-sm text-ink-600">
                            {t.title} <span className="text-ink-400">· {t.workspaceName}</span>
                          </p>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>

      <TaskDetailsPanel
        open={detailsOpen}
        task={detail?.task}
        workspaceId={detail?.workspaceId}
        statuses={detail?.statuses || []}
        onClose={() => setDetailsOpen(false)}
        onEdit={() => setEditorOpen(true)}
      />

      <TaskModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        workspaceId={detail?.workspaceId}
        members={detail?.members || []}
        statuses={(detail?.statuses || []).map((s) => ({ value: s.id, label: s.label }))}
        task={detail?.task}
        onSaved={(saved) => {
          setEditorOpen(false);
          setDetail((prev) => (prev ? { ...prev, task: saved } : prev));
          load(capacity);
        }}
        onDeleted={() => {
          setEditorOpen(false);
          setDetailsOpen(false);
          setDetail(null);
          load(capacity);
        }}
      />

      {detailLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink-900/10">
          <Spinner />
        </div>
      )}
    </>
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

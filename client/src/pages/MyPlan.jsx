import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, CalendarDays, CalendarRange, Rows3 } from "lucide-react";
import * as planApi from "../api/plan.js";
import * as tasksApi from "../api/tasks.js";
import * as workspacesApi from "../api/workspaces.js";
import * as taskStatusesApi from "../api/taskStatuses.js";
import { useSocket } from "../context/SocketContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../api/client.js";
import AtRiskPanel from "../components/plan/AtRiskPanel.jsx";
import ConflictsPanel from "../components/dashboard/ConflictsPanel.jsx";
import PlanFocusHero from "../components/plan/PlanFocusHero.jsx";
import PlanTimeline from "../components/plan/PlanTimeline.jsx";
import PlanWeek from "../components/plan/PlanWeek.jsx";
import PlanCalendar from "../components/plan/PlanCalendar.jsx";
import PlanRecommendations from "../components/plan/PlanRecommendations.jsx";
import { applyManualPlan, emptyManualPlan, manualPlanKey, movePlanItem, readManualPlan, validPlanDay } from "../components/plan/manualPlan.js";
import usePlanAnalysis from "../hooks/usePlanAnalysis.js";
import { buildDayLanes, pickFocus, toPlanItems } from "../components/plan/planModel.js";
import TaskModal from "../components/tasks/TaskModal.jsx";
import TaskDetailsPanel from "../components/tasks/TaskDetailsPanel.jsx";
import Spinner from "../components/common/Spinner.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Select from "../components/common/Select.jsx";
import PlanAvailability from "../components/plan/PlanAvailability.jsx";

const CAPACITY_KEY = "loft:plan-capacity";
const CAPACITY_OPTIONS = [2, 4, 6, 8, 10];
const VIEW_KEY = "loft:plan-view";
const VIEWS = [
  { id: "day", label: "Day by day", Icon: Rows3 },
  { id: "week", label: "Week", Icon: CalendarRange },
  { id: "calendar", label: "Calendar", Icon: CalendarDays },
];

export default function MyPlan() {
  const { user } = useAuth();
  return <MyPlanPage key={user.id} userId={user.id} aiEnabled={user.aiPriorityEnabled !== false} />;
}

function MyPlanPage({ userId, aiEnabled }) {
  const { socket } = useSocket();
  const [view, setView] = useState(() => {
    try {
      const stored = localStorage.getItem(VIEW_KEY);
      return VIEWS.some((v) => v.id === stored) ? stored : "day";
    } catch {
      return "day";
    }
  });
  const [capacity, setCapacity] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(`${CAPACITY_KEY}:${userId}`) || localStorage.getItem(CAPACITY_KEY));
      return CAPACITY_OPTIONS.includes(stored) ? stored : 6;
    } catch { return 6; }
  });
  const [preferences, setPreferences] = useState(() => readManualPlan(userId));
  const [aiOrder, setAiOrder] = useState([]);
  const [storageError, setStorageError] = useState("");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null); // { workspaceId, members, statuses, task }
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const requestId = useRef(0);
  const savingTasks = useRef(new Set());
  const initializedPreferences = useRef(false);
  const preferenceQueue = useRef(Promise.resolve());
  const [accountReady, setAccountReady] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const [saveRetry, setSaveRetry] = useState(0);

  // Two loads can overlap (e.g. a priority edit's reload racing a socket-driven
  // one) — only the most recently issued response is allowed to land, so a
  // slow, now-stale request can't clobber a fresher one.
  const load = useCallback(() => {
    const id = ++requestId.current;
    return planApi.getPlan(initializedPreferences.current ? capacity : undefined).then((data) => {
      if (id === requestId.current) {
        if (!initializedPreferences.current) {
          initializedPreferences.current = true;
          if (data.preferencesSaved) {
            setPreferences({ order: data.preferences.order, dates: data.preferences.dates });
            setCapacity(data.preferences.dailyCapacityHours);
          }
          setAccountReady(true);
        }
        setPlan(data); setError("");
      }
    }).catch((err) => {
      if (id === requestId.current) setError(apiErrorMessage(err));
    }).finally(() => {
      if (id === requestId.current) setLoading(false);
    });
  }, [capacity]);

  useEffect(() => {
    load();
    return () => { requestId.current++; };
  }, [load]);

  // Keep the server's capacity and Lofty's context consistent with the UI.
  useEffect(() => {
    try {
      localStorage.setItem(`${CAPACITY_KEY}:${userId}`, String(capacity));
    } catch {
      // localStorage unavailable — capacity just won't persist.
    }
  }, [capacity, userId]);

  useEffect(() => {
    try { localStorage.setItem(manualPlanKey(userId), JSON.stringify(preferences)); setStorageError(""); }
    catch { setStorageError("Your personal plan edits are available for this session. This browser could not save them for your next visit."); }
  }, [preferences, userId]);

  useEffect(() => {
    if (!accountReady) return;
    let current = true;
    const timer = setTimeout(() => {
      setAccountSaving(true);
      const patch = { ...preferences, dailyCapacityHours: capacity };
      preferenceQueue.current = preferenceQueue.current.catch(() => {}).then(() => planApi.savePreferences(patch));
      preferenceQueue.current.then(() => { if (current) setAccountError(""); }).catch((err) => { if (current) setAccountError(apiErrorMessage(err)); }).finally(() => { if (current) setAccountSaving(false); });
    }, 600);
    return () => { current = false; clearTimeout(timer); };
  }, [accountReady, preferences, capacity, saveRetry]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // localStorage unavailable — the view just won't persist.
    }
  }, [view]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => load();
    const socketEvents = ["task:created", "task:updated", "task:deleted", "event:created", "event:updated", "event:cancelled"];
    socketEvents.forEach((e) => socket.on(e, handler));
    return () => socketEvents.forEach((e) => socket.off(e, handler));
  }, [socket, load]);

  // Every view is derived from the flat task list, so patching the one task
  // there updates the day lanes, the week and the calendar at once.
  const items = useMemo(() => applyManualPlan(toPlanItems(plan?.tasks, capacity, new Date(), plan?.capacityByDate), preferences, aiEnabled ? aiOrder : []), [plan, capacity, preferences, aiEnabled, aiOrder]);
  const lanes = useMemo(() => buildDayLanes(items), [items]);
  const atRisk = useMemo(() => items.filter((it) => it.atRisk), [items]);
  const manual = useMemo(() => ({ order: preferences.order.filter((id) => plan?.tasks.some((task) => task.id === id)), dates: Object.fromEntries(Object.entries(preferences.dates).filter(([id]) => plan?.tasks.some((task) => task.id === id))) }), [preferences, plan]);
  const analysis = usePlanAnalysis({ userId, enabled: aiEnabled, plan, capacity, manual });
  useEffect(() => { if (analysis.data?.order) setAiOrder(analysis.data.order); }, [analysis.data]);

  // Shared by the status select and the pin/snooze toggles: patch the task
  // in place for an instant-feeling UI, persist it, then reload so the
  // server re-scores it — a pin or snooze moves the task's rank, not just
  // its badge.
  async function patchItem(item, patch) {
    if (savingTasks.current.has(item.taskId)) return;
    savingTasks.current.add(item.taskId);
    const previous = plan.tasks.find((task) => task.id === item.taskId);
    setPlan((prev) =>
      prev && {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === item.taskId ? { ...t, ...patch } : t)),
      }
    );
    try { await tasksApi.updateTask(item.workspaceId, item.taskId, patch); await load(); }
    catch (err) {
      setPlan((current) => current && { ...current, tasks: current.tasks.map((task) => task.id === item.taskId ? previous : task) });
      setError(apiErrorMessage(err));
    } finally { savingTasks.current.delete(item.taskId); }
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
  async function openTaskDetail(item, edit = false) {
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
        setDetailsOpen(!edit);
        setEditorOpen(edit);
      }
    } catch (err) { setError(apiErrorMessage(err));
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

  const hasTasks = items.length > 0;
  const hasConflicts = plan?.conflicts?.length > 0;
  const todayLane = lanes.find((l) => l.kind === "day" && l.offset === 0);
  const stats = {
    open: items.length,
    urgent: items.filter((t) => t.tier === "TIER_1").length,
    overdue: items.filter((item) => item.dueDate && new Date(item.dueDate) < new Date(new Date().setHours(0, 0, 0, 0))).length,
    atRisk: atRisk.length,
  };
  const rowHandlers = {
    statusesByWorkspace: plan?.statusesByWorkspace,
    onStatusChange: handleStatusChange,
    onTogglePin: handleTogglePin,
    onToggleSnooze: handleToggleSnooze,
    onTaskClick: openTaskDetail,
    onEditTask: (item) => openTaskDetail(item, true),
    onMove: (taskId, direction, visible) => setPreferences((current) => movePlanItem(current, visible, taskId, direction)),
    onPlannedDateChange: changePlannedDay,
  };

  function changePlannedDay(taskId, date) {
    if (date && !validPlanDay(date)) return;
    setPreferences((current) => {
      const dates = { ...current.dates };
      if (date) dates[taskId] = date; else delete dates[taskId];
      return { ...current, dates };
    });
  }

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        {accountSaving && <p role="status" className="text-xs text-ink-500">Saving personal plan…</p>}
        {accountError && <p role="alert" className="text-sm text-red-600">Your plan is saved on this device, but account sync failed. {accountError} <button className="underline" onClick={() => setSaveRetry((value) => value + 1)}>Retry sync</button></p>}
        {plan?.preferences && <PlanAvailability key={JSON.stringify([plan.preferences.hoursByWeekday, plan.preferences.accountForMeetings, plan.preferences.timeZone])} preferences={plan.preferences} onSaved={load} />}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-ink-900 dark:text-ink-50">My Plan</h2>
            <p className="text-sm text-ink-500">Your tasks across workspaces, with Lofty’s guidance and room to plan your own way.</p>
            {view !== "calendar" && (
              <div className="mt-2 flex items-center gap-2 text-sm text-ink-600 dark:text-ink-300">
                <label htmlFor="plan-capacity">Hours per day</label>
                <Select
                  id="plan-capacity"
                  className="!w-24"
                  value={capacity}
                  onChange={setCapacity}
                  options={CAPACITY_OPTIONS.map((h) => ({ value: h, label: `${h}h` }))}
                />
              </div>
            )}
          </div>

          {/* Full width on phones, where three labelled tabs are wider than
              the screen; the icons only come back when there's room. */}
          <div
            className="flex w-full shrink-0 items-center gap-1 rounded-xl bg-ink-900/[0.05] p-1 text-sm dark:bg-white/[0.05] sm:w-auto"
            role="group"
            aria-label="Plan view"
          >
            {VIEWS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => setView(id)}
                className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium transition-colors sm:flex-none sm:justify-start sm:px-3 ${
                  view === id
                    ? "bg-white text-ink-800 shadow-soft dark:bg-ink-800 dark:text-ink-100"
                    : "text-ink-500 hover:text-ink-800 dark:hover:text-ink-200"
                }`}
              >
                <Icon className="hidden h-4 w-4 sm:block" /> {label}
              </button>
            ))}
          </div>
        </div>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}<button type="button" className="ml-3 min-h-11 underline" onClick={load}>Retry</button></div>}
        {storageError && <p role="status" className="text-sm text-ink-500">{storageError}</p>}

        {!plan ? null : !hasTasks && !hasConflicts ? (
          <EmptyState
            icon={<CalendarCheck className="h-5 w-5" />}
            title="Nothing to plan yet"
            description="Tasks assigned to you across every workspace will show up here, ranked and sorted into a day-by-day plan."
          />
        ) : (
          <>
            {hasTasks && <>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-500">
                <p>{aiEnabled ? "Lofty analyzes priorities automatically. Reorder or edit any task below." : "Automatic AI analysis is off. Reorder or edit any task below."}</p>
                {(preferences.order.length > 0 || Object.keys(preferences.dates).length > 0) && <button type="button" className="min-h-11 text-brand-700 underline dark:text-brand-300" onClick={() => setPreferences(emptyManualPlan())}>Reset personal changes</button>}
              </div>
              {aiEnabled && <PlanRecommendations analysis={analysis} tasks={plan.tasks} onOpen={openTaskDetail} />}
            </>}
            {hasTasks && (
              <PlanFocusHero
                focus={pickFocus(lanes)}
                todayHours={todayLane?.hours || 0}
                capacity={capacity}
                stats={stats}
                onOpen={openTaskDetail}
              />
            )}

            {hasConflicts && (
              <ConflictsPanel title="Cross-workspace conflicts" conflicts={plan.conflicts} />
            )}

            {hasTasks && (
              <>
                <AtRiskPanel items={atRisk} />

                {view === "day" && <PlanTimeline lanes={lanes} capacity={capacity} {...rowHandlers} />}
                {view === "week" && <PlanWeek items={items} capacity={capacity} {...rowHandlers} />}
                {view === "calendar" && (
                  <PlanCalendar tasks={items} events={plan.events || []} {...rowHandlers} />
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
        statuses={(detail?.statuses || []).map((s) => ({ value: s.id, label: s.label, color: s.color }))}
        task={detail?.task}
        onSaved={(saved) => {
          setEditorOpen(false);
          setDetail((prev) => (prev ? { ...prev, task: saved } : prev));
          load();
        }}
        onDeleted={() => {
          setEditorOpen(false);
          setDetailsOpen(false);
          setDetail(null);
          load();
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


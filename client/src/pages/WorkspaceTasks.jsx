import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import * as tasksApi from "../api/tasks.js";
import * as workspacesApi from "../api/workspaces.js";
import * as taskStatusesApi from "../api/taskStatuses.js";
import { useSocket } from "../context/SocketContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import TaskCard from "../components/tasks/TaskCard.jsx";
import TaskModal from "../components/tasks/TaskModal.jsx";
import TaskDetailsPanel from "../components/tasks/TaskDetailsPanel.jsx";
import TaskStatusManagerModal from "../components/tasks/TaskStatusManagerModal.jsx";
import TaskViewToolbar from "../components/tasks/TaskViewToolbar.jsx";
import TaskListView from "../components/tasks/TaskListView.jsx";
import TaskTableView, { TASK_TABLE_COLUMNS } from "../components/tasks/TaskTableView.jsx";
import TaskCalendarView from "../components/tasks/TaskCalendarView.jsx";
import Spinner from "../components/common/Spinner.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import { apiErrorMessage } from "../api/client.js";
import { DEFAULT_TASK_FILTERS, readTaskView, saveTaskView, filterTasks, sortTasks, taskDropOrder, localDateKey } from "../lib/taskViews.js";
import { displayColor } from "../lib/colors.js";
import { can } from "../lib/access.js";

export default function WorkspaceTasks() {
  const { workspaceId } = useParams();
  const { socket } = useSocket();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [access, setAccess] = useState(null);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTaskId, setDetailsTaskId] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null); // { status, index }
  const [view, setView] = useState(() => readTaskView(user.id, workspaceId));
  const [filters, setFilters] = useState({ ...DEFAULT_TASK_FILTERS });
  const [sort, setSort] = useState({ key: "order", direction: "asc" });
  const [groupBy, setGroupBy] = useState("status");
  const [tableColumns, setTableColumns] = useState(TASK_TABLE_COLUMNS.map((column) => column.key));
  const [savingIds, setSavingIds] = useState(new Set());
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const loadRequest = useRef(0);
  const pendingWrites = useRef(new Set());
  const needsReload = useRef(false);
  const workspaceRef = useRef(workspaceId);
  const scopeVersion = useRef(0);
  const [today, setToday] = useState(() => localDateKey());
  workspaceRef.current = workspaceId;

  useEffect(() => {
    const timer = setInterval(() => setToday(localDateKey()), 60000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    try {
      const [t, workspace, statuses] = await Promise.all([
        tasksApi.listWorkspaceTasks(workspaceId),
        workspacesApi.getWorkspace(workspaceId),
        taskStatusesApi.listTaskStatuses(workspaceId),
      ]);
      if (request !== loadRequest.current) return;
      setTasks(t);
      setMembers(workspace.members);
      setAccess(workspace);
      setColumns(statuses);
      setLoadError("");
    } catch (err) {
      if (request === loadRequest.current) setLoadError(apiErrorMessage(err));
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    scopeVersion.current++;
    setLoading(true);
    setTasks([]);
    setColumns([]);
    setMembers([]);
    setAccess(null);
    setFilters({ ...DEFAULT_TASK_FILTERS });
    setView(readTaskView(user.id, workspaceId));
    setSort({ key: "order", direction: "asc" });
    setTableColumns(TASK_TABLE_COLUMNS.map((column) => column.key));
    setError("");
    setLoadError("");
    setDetailsOpen(false);
    setDetailsTaskId(null);
    setModalOpen(false);
    setStatusModalOpen(false);
    setDraggedId(null);
    setDropIndicator(null);
    pendingWrites.current.clear();
    needsReload.current = false;
    setSavingIds(new Set());
    load();
    return () => { loadRequest.current++; scopeVersion.current++; };
  }, [load, user.id, workspaceId]);

  useEffect(() => {
    if (!socket) return;
    const handler = (event) => {
      if (event?.workspaceId && event.workspaceId !== workspaceId) return;
      if (pendingWrites.current.size) { needsReload.current = true; return; }
      load();
    };
    const events = [
      "connect",
      "task:created",
      "task:updated",
      "task:deleted",
      "taskStatus:created",
      "taskStatus:updated",
      "taskStatus:deleted",
    ];
    events.forEach((e) => socket.on(e, handler));
    return () => events.forEach((e) => socket.off(e, handler));
  }, [socket, load, workspaceId]);

  const detailsTask = detailsTaskId ? tasks.find((t) => t.id === detailsTaskId) : null;

  const canEditStatuses = can(access, "statuses.manage");
  const visibleTasks = useMemo(() => filterTasks(tasks, filters, columns, user.id), [tasks, filters, columns, user.id, today]);
  const sortedTasks = useMemo(() => sortTasks(visibleTasks, sort, columns), [visibleTasks, sort, columns]);
  const filtered = Object.entries(filters).some(([key, value]) => value !== DEFAULT_TASK_FILTERS[key]);

  useEffect(() => {
    if (columns.length && filters.status !== "all" && !columns.some((column) => column.id === filters.status)) {
      setFilters((prev) => ({ ...prev, status: "all" }));
    }
  }, [columns, filters.status]);

  function changeView(next) {
    setView(next);
    setDraggedId(null);
    setDropIndicator(null);
    saveTaskView(user.id, workspaceId, next);
  }

  function openTask(task) {
    setDetailsTaskId(task.id);
    setDetailsOpen(true);
  }

  function editTask(task) {
    setEditingTask(task);
    setModalOpen(true);
  }

  async function saveTaskChange(task, data, optimistic = false) {
    if (pendingWrites.current.has(task.id)) return;
    const targetWorkspace = workspaceId;
    const version = scopeVersion.current;
    const isCurrent = () => workspaceRef.current === targetWorkspace && version === scopeVersion.current;
    loadRequest.current++; // Ignore history fetched before this write.
    pendingWrites.current.add(task.id);
    setSavingIds(new Set(pendingWrites.current));
    setError("");
    if (optimistic) setTasks((prev) => prev.map((item) => item.id === task.id ? { ...item, ...data } : item));
    try {
      const saved = await tasksApi.updateTask(targetWorkspace, task.id, data);
      if (!isCurrent()) return;
      setTasks((prev) => prev.map((item) => item.id === task.id ? { ...item, ...saved } : item));
    } catch (err) {
      if (!isCurrent()) return;
      if (optimistic) setTasks((prev) => prev.map((item) => item.id === task.id ? { ...item, ...Object.fromEntries(Object.keys(data).map((key) => [key, task[key]])) } : item));
      setError(apiErrorMessage(err));
    } finally {
      if (isCurrent()) {
        pendingWrites.current.delete(task.id);
        setSavingIds(new Set(pendingWrites.current));
        if (!pendingWrites.current.size && needsReload.current) { needsReload.current = false; load(); }
      }
    }
  }

  function changeTaskStatus(task, status) {
    if (status === task.status || !canMoveTask(task) || !columns.some((column) => column.id === status)) return;
    const order = Math.max(0, ...tasks.filter((item) => item.status === status).map((item) => item.order || 0)) + 1;
    return saveTaskChange(task, { status, order });
  }

  // A member moves only their own tasks between columns; tasks.status (every
  // admin has it) moves anyone's. The server enforces the same rule. Anyone
  // can still reorder a task within the column it's in.
  function canMoveTask(task) {
    return can(access, "tasks.status") || task.assignee?.id === user.id;
  }

  function canDropIn(status) {
    const dragged = tasks.find((t) => t.id === draggedId);
    return !!dragged && (dragged.status === status || canMoveTask(dragged));
  }

  function columnTasks(status) {
    return visibleTasks.filter((t) => t.status === status).sort((a, b) => a.order - b.order);
  }

  function handleDragStart(e, task) {
    setDraggedId(task.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDropIndicator(null);
  }

  function handleCardDragOver(e, status, index) {
    if (!draggedId) return;
    if (!canDropIn(status)) return setDropIndicator(null);
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const isAfter = e.clientY - rect.top > rect.height / 2;
    setDropIndicator({ status, index: isAfter ? index + 1 : index });
  }

  function handleColumnDragOver(e, status) {
    if (!draggedId) return;
    if (!canDropIn(status)) return setDropIndicator(null);
    e.preventDefault();
    if (!dropIndicator || dropIndicator.status !== status) {
      setDropIndicator({ status, index: columnTasks(status).length });
    }
  }

  async function handleDrop(e, status) {
    e.preventDefault();
    const taskId = draggedId;
    const indicator = dropIndicator;
    setDraggedId(null);
    setDropIndicator(null);
    if (!taskId || !indicator || indicator.status !== status) return;

    const dragged = tasks.find((t) => t.id === taskId);
    if (!dragged || (dragged.status !== status && !canMoveTask(dragged))) return;

    const order = taskDropOrder(tasks, visibleTasks, taskId, status, indicator.index);
    await saveTaskChange(dragged, { status, order }, true);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 p-4 sm:gap-4 sm:p-6">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-ink-900 dark:text-ink-50 sm:text-2xl">Tasks</h2>
          <div className="flex items-center gap-2">
            {canEditStatuses && (
              <button
                className="btn-secondary max-sm:!px-2.5"
                onClick={() => setStatusModalOpen(true)}
                aria-label="Customize statuses"
                title="Customize statuses"
              >
                <SlidersHorizontal className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">Customize statuses</span>
              </button>
            )}
            <button
              className="btn-primary"
              onClick={() => {
                setEditingTask(null);
                setModalOpen(true);
              }}
            >
              + New task
            </button>
          </div>
        </div>

        {(error || loadError) && <div role="alert" className="flex shrink-0 items-center gap-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
          <span className="flex-1">{error || loadError}</span>
          {loadError && <button type="button" onClick={load} className="font-semibold underline">Retry</button>}
          {error && <button type="button" onClick={() => setError("")} className="font-semibold underline">Dismiss</button>}
        </div>}
        <TaskViewToolbar view={view} onViewChange={changeView} filters={filters} onFiltersChange={setFilters} statuses={columns} members={members} total={tasks.length} visible={visibleTasks.length} sort={sort} onSortChange={setSort} groupBy={groupBy} onGroupChange={setGroupBy} />

        {!visibleTasks.length && (filtered || view !== "board" || !columns.length) ? <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="text-center"><EmptyState title={filtered ? "No matching tasks" : loadError ? "Couldn't load tasks" : "No tasks yet"} description={filtered ? "Try another search or change your filters." : "Create a task to get started."} />
            {filtered && <button type="button" onClick={() => setFilters({ ...DEFAULT_TASK_FILTERS })} className="btn-secondary mt-3 text-xs">Clear filters</button>}
          </div>
        </div> : view === "list" ? <TaskListView tasks={sortedTasks} statuses={columns} groupBy={groupBy} onOpen={openTask} onEdit={editTask} canMoveTask={canMoveTask} onStatusChange={changeTaskStatus} savingIds={savingIds} />
          : view === "table" ? <TaskTableView tasks={sortedTasks} statuses={columns} sort={sort} onSortChange={setSort} visibleColumns={tableColumns} onColumnsChange={setTableColumns} onOpen={openTask} onEdit={editTask} canMoveTask={canMoveTask} onStatusChange={changeTaskStatus} savingIds={savingIds} />
          : view === "calendar" ? <TaskCalendarView tasks={visibleTasks} statuses={columns} onOpen={openTask} /> : (

        <div className="-mx-4 flex min-h-0 flex-1 snap-x snap-mandatory scroll-px-4 items-start gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:mx-0 sm:snap-none sm:gap-4 sm:px-0">
          {/* Phones get one column per swipe, with the next column peeking in. */}
          {columns.map((col) => {
            const colTasks = columnTasks(col.id);
            const showIndicator = dropIndicator?.status === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleColumnDragOver(e, col.id)}
                onDrop={(e) => handleDrop(e, col.id)}
                className="flex max-h-full w-[calc(100vw-4.5rem)] max-w-[22rem] shrink-0 snap-start flex-col rounded-2xl sm:w-auto sm:min-w-[260px] sm:max-w-none sm:flex-1 sm:shrink border border-white/50 bg-white/30 p-3 backdrop-blur-md transition-colors dark:border-white/[0.06] dark:bg-white/[0.02]"
              >
                <div className="mb-2 flex shrink-0 items-center justify-between px-1">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-700 dark:text-ink-200">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: displayColor(col.color) }} />
                    {col.label}
                  </h3>
                  <span className="chip !px-2 !py-0.5 tabular-nums">{colTasks.length}</span>
                </div>
                {/* Bleeds into the column's padding so the scroll box doesn't clip the cards' hover glow. */}
                <div className="-mx-3 -mb-3 min-h-0 space-y-2 overflow-y-auto px-3 pb-3 pt-1">
                  {colTasks.map((t, i) => (
                    <div key={t.id} data-task-id={t.id}>
                      {showIndicator && dropIndicator.index === i && <DropLine />}
                      <div onDragOver={(e) => handleCardDragOver(e, col.id, i)}>
                        <TaskCard
                          task={t}
                          dragging={draggedId === t.id}
                          isDoneColumn={col.isDone}
                          draggable={!savingIds.has(t.id)}
                          onClick={() => openTask(t)}
                          onEdit={() => editTask(t)}
                          dragHandlers={{
                            onDragStart: (e) => handleDragStart(e, t),
                            onDragEnd: handleDragEnd,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {showIndicator && dropIndicator.index === colTasks.length && <DropLine />}
                  {colTasks.length === 0 && !showIndicator && (
                    <p className="rounded-xl border border-dashed border-ink-300/50 px-1 py-5 text-center text-xs text-ink-400 dark:border-white/10">
                      Drop tasks here
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        workspaceId={workspaceId}
        members={members}
        statuses={columns.map((c) => ({ value: c.id, label: c.label, color: c.color }))}
        task={editingTask}
        canChangeStatus={!editingTask || canMoveTask(editingTask)}
        onSaved={(saved) => {
          setTasks((prev) => {
            const exists = prev.some((t) => t.id === saved.id);
            return exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved];
          });
        }}
        onDeleted={(id) => {
          setTasks((prev) => prev.filter((t) => t.id !== id));
          if (detailsTaskId === id) setDetailsOpen(false);
        }}
      />

      <TaskDetailsPanel
        open={detailsOpen}
        task={detailsTask}
        workspaceId={workspaceId}
        statuses={columns}
        onClose={() => setDetailsOpen(false)}
        onEdit={() => {
          setEditingTask(detailsTask);
          setModalOpen(true);
        }}
      />

      {canEditStatuses && (
        <TaskStatusManagerModal
          open={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          workspaceId={workspaceId}
          statuses={columns}
          onChanged={setColumns}
        />
      )}
    </>
  );
}

function DropLine() {
  return <div className="h-0.5 rounded-full bg-brand-400 shadow-glow" />;
}

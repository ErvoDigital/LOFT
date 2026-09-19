import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import * as tasksApi from "../api/tasks.js";
import * as workspacesApi from "../api/workspaces.js";
import * as taskStatusesApi from "../api/taskStatuses.js";
import { useSocket } from "../context/SocketContext.jsx";
import TaskCard from "../components/tasks/TaskCard.jsx";
import TaskModal from "../components/tasks/TaskModal.jsx";
import TaskDetailsPanel from "../components/tasks/TaskDetailsPanel.jsx";
import TaskStatusManagerModal from "../components/tasks/TaskStatusManagerModal.jsx";
import Spinner from "../components/common/Spinner.jsx";
import { displayColor } from "../lib/colors.js";

export default function WorkspaceTasks() {
  const { workspaceId } = useParams();
  const { socket } = useSocket();
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTaskId, setDetailsTaskId] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null); // { status, index }
  const suppressReload = useRef(false);

  const load = useCallback(() => {
    Promise.all([
      tasksApi.listWorkspaceTasks(workspaceId),
      workspacesApi.getWorkspace(workspaceId),
      taskStatusesApi.listTaskStatuses(workspaceId),
    ]).then(([t, workspace, statuses]) => {
      setTasks(t);
      setMembers(workspace.members);
      setIsAdmin(workspace.myRole === "ADMIN");
      setColumns(statuses);
      setLoading(false);
    });
  }, [workspaceId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      if (suppressReload.current) return;
      load();
    };
    const events = [
      "task:created",
      "task:updated",
      "task:deleted",
      "taskStatus:created",
      "taskStatus:updated",
      "taskStatus:deleted",
    ];
    events.forEach((e) => socket.on(e, handler));
    return () => events.forEach((e) => socket.off(e, handler));
  }, [socket, load]);

  const detailsTask = detailsTaskId ? tasks.find((t) => t.id === detailsTaskId) : null;

  function columnTasks(status) {
    return tasks.filter((t) => t.status === status).sort((a, b) => a.order - b.order);
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
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const isAfter = e.clientY - rect.top > rect.height / 2;
    setDropIndicator({ status, index: isAfter ? index + 1 : index });
  }

  function handleColumnDragOver(e, status) {
    if (!draggedId) return;
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
    if (!taskId || !indicator) return;

    const dragged = tasks.find((t) => t.id === taskId);
    if (!dragged) return;

    const targetList = columnTasks(status).filter((t) => t.id !== taskId);
    const insertAt = Math.min(indicator.index, targetList.length);
    const before = targetList[insertAt - 1];
    const after = targetList[insertAt];
    const newOrder = before && after ? (before.order + after.order) / 2 : before ? before.order + 1 : after ? after.order - 1 : 1;

    suppressReload.current = true;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status, order: newOrder } : t)));
    try {
      await tasksApi.updateTask(workspaceId, taskId, { status, order: newOrder });
    } finally {
      setTimeout(() => (suppressReload.current = false), 300);
    }
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
      <div className="flex h-full flex-col gap-4 p-6">
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">Tasks</h2>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button className="btn-secondary" onClick={() => setStatusModalOpen(true)}>
                Customize statuses
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

        <div className="flex min-h-0 flex-1 items-start gap-4 overflow-x-auto pb-2">
          {columns.map((col) => {
            const colTasks = columnTasks(col.id);
            const showIndicator = dropIndicator?.status === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleColumnDragOver(e, col.id)}
                onDrop={(e) => handleDrop(e, col.id)}
                className="flex max-h-full min-w-[260px] flex-1 flex-col rounded-2xl border border-white/50 bg-white/30 p-3 backdrop-blur-md transition-colors dark:border-white/[0.06] dark:bg-white/[0.02]"
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
                    <div key={t.id}>
                      {showIndicator && dropIndicator.index === i && <DropLine />}
                      <div onDragOver={(e) => handleCardDragOver(e, col.id, i)}>
                        <TaskCard
                          task={t}
                          dragging={draggedId === t.id}
                          isDoneColumn={col.isDone}
                          onClick={() => {
                            setDetailsTaskId(t.id);
                            setDetailsOpen(true);
                          }}
                          onEdit={() => {
                            setEditingTask(t);
                            setModalOpen(true);
                          }}
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
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        workspaceId={workspaceId}
        members={members}
        statuses={columns.map((c) => ({ value: c.id, label: c.label, color: c.color }))}
        task={editingTask}
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

      {isAdmin && (
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

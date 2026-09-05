import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import * as tasksApi from "../api/tasks.js";
import * as workspacesApi from "../api/workspaces.js";
import * as taskStatusesApi from "../api/taskStatuses.js";
import { useSocket } from "../context/SocketContext.jsx";
import TaskCard from "../components/tasks/TaskCard.jsx";
import TaskModal from "../components/tasks/TaskModal.jsx";
import TaskStatusManagerModal from "../components/tasks/TaskStatusManagerModal.jsx";
import Spinner from "../components/common/Spinner.jsx";

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
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-900">Tasks</h2>
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

      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((col) => {
          const colTasks = columnTasks(col.id);
          const showIndicator = dropIndicator?.status === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleColumnDragOver(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className="min-w-[240px] flex-1 rounded-xl border border-ink-200 bg-ink-50 p-3"
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: col.color }} />
                  {col.label}
                </h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-ink-500 border border-ink-200">{colTasks.length}</span>
              </div>
              <div className="space-y-2">
                {colTasks.map((t, i) => (
                  <div key={t.id}>
                    {showIndicator && dropIndicator.index === i && <DropLine />}
                    <div onDragOver={(e) => handleCardDragOver(e, col.id, i)}>
                      <TaskCard
                        task={t}
                        dragging={draggedId === t.id}
                        isDoneColumn={col.isDone}
                        onClick={() => {
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
                  <p className="px-1 py-4 text-center text-xs text-ink-300">Drop tasks here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        workspaceId={workspaceId}
        members={members}
        statuses={columns.map((c) => ({ value: c.id, label: c.label }))}
        task={editingTask}
        onSaved={(saved) => {
          setTasks((prev) => {
            const exists = prev.some((t) => t.id === saved.id);
            return exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved];
          });
        }}
        onDeleted={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
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
    </div>
  );
}

function DropLine() {
  return <div className="h-0.5 rounded-full bg-brand-400" />;
}

// Detects cross-workspace scheduling conflicts for a user — LOFT's core
// differentiator: surfacing collisions that only exist because a person
// belongs to several independent workspaces that can't see each other.

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// events: [{ id, title, workspaceId, workspaceName, startTime, endTime }]
// tasks:  [{ id, title, workspaceId, workspaceName, dueDate, priority }] — callers
// are expected to have already excluded tasks in a "done" status.
export function detectConflicts({ events, tasks }) {
  const conflicts = [];

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (a.workspaceId === b.workspaceId) continue;
      if (overlaps(new Date(a.startTime), new Date(a.endTime), new Date(b.startTime), new Date(b.endTime))) {
        conflicts.push({
          type: "EVENT_OVERLAP",
          severity: "high",
          message: `"${a.title}" (${a.workspaceName}) overlaps "${b.title}" (${b.workspaceName})`,
          items: [
            { kind: "event", id: a.id, title: a.title, workspaceId: a.workspaceId, workspaceName: a.workspaceName, time: a.startTime },
            { kind: "event", id: b.id, title: b.title, workspaceId: b.workspaceId, workspaceName: b.workspaceName, time: b.startTime },
          ],
        });
      }
    }
  }

  const datedTasks = tasks.filter((t) => t.dueDate);
  for (let i = 0; i < datedTasks.length; i++) {
    for (let j = i + 1; j < datedTasks.length; j++) {
      const a = datedTasks[i];
      const b = datedTasks[j];
      if (a.workspaceId === b.workspaceId) continue;
      if (sameDay(new Date(a.dueDate), new Date(b.dueDate))) {
        conflicts.push({
          type: "DEADLINE_CLASH",
          severity: a.priority === "URGENT" || b.priority === "URGENT" ? "high" : "medium",
          message: `"${a.title}" (${a.workspaceName}) and "${b.title}" (${b.workspaceName}) are both due ${new Date(a.dueDate).toDateString()}`,
          items: [
            { kind: "task", id: a.id, title: a.title, workspaceId: a.workspaceId, workspaceName: a.workspaceName, time: a.dueDate },
            { kind: "task", id: b.id, title: b.title, workspaceId: b.workspaceId, workspaceName: b.workspaceName, time: b.dueDate },
          ],
        });
      }
    }
  }

  for (const task of datedTasks) {
    for (const event of events) {
      if (task.workspaceId === event.workspaceId) continue;
      if (sameDay(new Date(task.dueDate), new Date(event.startTime))) {
        conflicts.push({
          type: "TASK_EVENT_SAME_DAY",
          severity: "low",
          message: `Task "${task.title}" (${task.workspaceName}) is due the same day as "${event.title}" (${event.workspaceName})`,
          items: [
            { kind: "task", id: task.id, title: task.title, workspaceId: task.workspaceId, workspaceName: task.workspaceName, time: task.dueDate },
            { kind: "event", id: event.id, title: event.title, workspaceId: event.workspaceId, workspaceName: event.workspaceName, time: event.startTime },
          ],
        });
      }
    }
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return conflicts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

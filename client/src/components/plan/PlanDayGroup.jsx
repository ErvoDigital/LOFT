import PlanTaskRow from "./PlanTaskRow.jsx";

function formatDayLabel(iso, isToday) {
  const d = new Date(iso);
  if (isToday) return "Today";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((new Date(d.toDateString()) - today) / 86400000);
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export default function PlanDayGroup({ day, statusesByWorkspace, onStatusChange, onTogglePin, onToggleSnooze, onTaskClick }) {
  const overCapacity = day.plannedHours > day.capacityHours;

  return (
    <div className={`card p-4 ${day.isToday ? "border-brand-300 ring-1 ring-brand-100" : ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-ink-800">{formatDayLabel(day.date, day.isToday)}</h4>
        <span className={`text-xs font-medium ${overCapacity ? "text-red-500" : "text-ink-400"}`}>
          {day.plannedHours}h / {day.capacityHours}h
        </span>
      </div>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full ${overCapacity ? "bg-red-400" : "bg-brand-400"}`}
          style={{ width: `${Math.min(100, (day.plannedHours / day.capacityHours) * 100)}%` }}
        />
      </div>
      <div className="space-y-1">
        {day.items.map((item) => (
          <PlanTaskRow
            key={`${item.taskId}-${day.date}`}
            item={item}
            statuses={statusesByWorkspace?.[item.workspaceId]}
            onStatusChange={onStatusChange}
            onTogglePin={onTogglePin}
            onToggleSnooze={onToggleSnooze}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </div>
  );
}

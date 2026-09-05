import Avatar from "../common/Avatar.jsx";
import { PriorityBadge } from "../common/Badges.jsx";

export default function TaskCard({ task, onClick, dragHandlers, dragging, isDoneColumn }) {
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDoneColumn;

  return (
    <button
      onClick={onClick}
      draggable
      {...dragHandlers}
      className={`w-full cursor-grab rounded-lg border border-ink-200 bg-white p-3 text-left shadow-soft transition-all hover:border-brand-300 hover:shadow-panel active:cursor-grabbing ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-800">{task.title}</p>
        <PriorityBadge priority={task.priority} />
      </div>
      {task.description && <p className="mb-2 line-clamp-2 text-xs text-ink-400">{task.description}</p>}
      <div className="flex items-center justify-between">
        {task.dueDate ? (
          <span className={`text-xs font-medium ${overdue ? "text-red-500" : "text-ink-400"}`}>
            {overdue ? "Overdue · " : "Due "}
            {new Date(task.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
          </span>
        ) : (
          <span className="text-xs text-ink-300">No due date</span>
        )}
        {task.assignee ? (
          <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size={22} />
        ) : (
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-dashed border-ink-200 text-[10px] text-ink-300">
            ?
          </span>
        )}
      </div>
    </button>
  );
}

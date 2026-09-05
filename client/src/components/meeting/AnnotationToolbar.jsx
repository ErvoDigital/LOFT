import { MousePointer2, Pencil, Highlighter, Square, Circle, Minus, Type, Undo2, Trash2 } from "lucide-react";

const TOOLS = [
  { id: "pan", Icon: MousePointer2, title: "Pointer (pan / zoom)" },
  { id: "pen", Icon: Pencil, title: "Pen" },
  { id: "highlight", Icon: Highlighter, title: "Highlighter" },
  { id: "rect", Icon: Square, title: "Rectangle" },
  { id: "ellipse", Icon: Circle, title: "Circle" },
  { id: "line", Icon: Minus, title: "Line" },
  { id: "text", Icon: Type, title: "Text" },
];

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ffffff"];

export default function AnnotationToolbar({ tool, onToolChange, color, onColorChange, onUndo, onClear, canUndo, canClear }) {
  return (
    <div onPointerDown={(e) => e.stopPropagation()} className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg bg-ink-900/70 p-1">
      {TOOLS.map(({ id, Icon, title }) => (
        <button
          key={id}
          onClick={() => onToolChange(id)}
          title={title}
          aria-label={title}
          className={`flex h-7 w-7 items-center justify-center rounded ${
            tool === id ? "bg-brand-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}

      <div className="mx-1 h-5 w-px bg-white/15" />

      {COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onColorChange(c)}
          title={c}
          aria-label={`Color ${c}`}
          className={`h-5 w-5 shrink-0 rounded-full ring-offset-2 ring-offset-ink-900 ${color === c ? "ring-2 ring-white" : ""}`}
          style={{ backgroundColor: c }}
        />
      ))}

      <div className="mx-1 h-5 w-px bg-white/15" />

      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo last mark"
        aria-label="Undo last mark"
        className="flex h-7 w-7 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        onClick={onClear}
        disabled={!canClear}
        title="Clear all marks"
        aria-label="Clear all marks"
        className="flex h-7 w-7 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

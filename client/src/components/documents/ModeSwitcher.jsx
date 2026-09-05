import { useEffect, useRef, useState } from "react";
import { Pencil, MessageSquarePlus, Eye, ChevronDown, Check } from "lucide-react";

const MODES = [
  { id: "editing", label: "Editing", desc: "Edit document directly", Icon: Pencil },
  { id: "suggesting", label: "Suggesting", desc: "New text is tracked as a suggestion", Icon: MessageSquarePlus },
  { id: "viewing", label: "Viewing", desc: "Read or print final document", Icon: Eye },
];

export default function ModeSwitcher({ mode, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = MODES.find((m) => m.id === mode) || MODES[0];

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1 text-sm text-ink-600 hover:bg-ink-50"
      >
        <active.Icon className="h-3.5 w-3.5 text-ink-400" />
        {active.label}
        <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 card p-1.5 shadow-panel">
          {MODES.map(({ id, label, desc, Icon }) => (
            <button
              key={id}
              onClick={() => {
                onChange(id);
                setOpen(false);
              }}
              className={`flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-ink-50 ${
                mode === id ? "bg-brand-50" : ""
              }`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink-800">{label}</span>
                <span className="block text-xs text-ink-400">{desc}</span>
              </span>
              {mode === id && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

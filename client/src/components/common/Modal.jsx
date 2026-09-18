import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Modal({ open, onClose, title, children, width = "max-w-md" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Portaled to document.body: AppShell's <main> has overflow-y-auto, and a
  // non-visible overflow on an ancestor clips position:fixed descendants to
  // its own box in every major browser — without the portal this backdrop
  // only covered the content pane, leaving the sidebar/topbar undimmed.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm dark:bg-ink-950/70" onClick={onClose} />
      <div className={`relative w-full ${width} card animate-slide-fade-in p-6 shadow-glass-lg`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-ink-900 dark:text-ink-50">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-700 dark:hover:bg-white/[0.08] dark:hover:text-ink-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

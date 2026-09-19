import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid } from "lucide-react";
import useFloatingPanel from "../common/useFloatingPanel.js";
import { WIDGETS } from "./dashboardLayout.js";

// The "Widgets" menu: one switch per dashboard widget. Toggling one takes
// effect right away. Outside layout editing it's saved immediately; while
// editing it's part of the unsaved draft.
export default function WidgetPicker({ hidden, onToggle, onShowAll }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  const { style } = useFloatingPanel({ open, triggerRef, panelRef, onClose: close, align: "end" });

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const shown = WIDGETS.length - hidden.length;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`btn-secondary px-3 py-1.5 text-xs ${open ? "!border-brand-400/60" : ""}`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Widgets
        <span className="rounded-full bg-ink-900/[0.06] px-1.5 text-[10px] font-semibold tabular-nums dark:bg-white/10">
          {shown}/{WIDGETS.length}
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={style}
            role="dialog"
            aria-label="Choose dashboard widgets"
            className="dropdown-panel fixed z-[60] w-[21rem] !bg-white p-2 ring-1 ring-ink-900/[0.06] motion-safe:animate-[fade-in_0.12s_ease-out] dark:!bg-ink-800 dark:ring-0"
          >
            <div className="flex items-baseline justify-between gap-3 px-2 pb-2 pt-1">
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Show on dashboard</p>
              {hidden.length > 0 && (
                <button
                  type="button"
                  onClick={onShowAll}
                  className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
                >
                  Show all
                </button>
              )}
            </div>
            <ul className="space-y-0.5">
              {WIDGETS.map((w) => {
                const on = !hidden.includes(w.id);
                return (
                  <li key={w.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-brand-500/[0.07]">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink-800 dark:text-ink-100">{w.title}</span>
                        <span className="block text-xs text-ink-500 dark:text-ink-400">{w.description}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => onToggle(w.id, on)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className="relative h-5 w-9 shrink-0 rounded-full bg-ink-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-brand-500 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white dark:bg-white/15 dark:peer-checked:bg-brand-500 dark:peer-focus-visible:ring-offset-ink-900"
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}

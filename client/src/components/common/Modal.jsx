import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// `header` replaces the plain title line (pass a string `title` too, so the
// dialog keeps an accessible name); `footer` stays pinned under the scrolling
// body, for actions that must stay in reach on a long form.
export default function Modal({ open, onClose, title, header, footer, children, width = "max-w-md" }) {
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
  // On phones the dialog is a bottom sheet: pinned to the lower edge where a
  // thumb can reach it, capped at the viewport height, with its body scrolling
  // under a fixed header. From `sm` up it is the centered card.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/50 backdrop-blur-sm dark:bg-ink-950/70" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={`card relative flex max-h-[92vh] w-full flex-col rounded-b-none shadow-glass-lg max-sm:animate-sheet-up supports-[height:100dvh]:max-h-[92dvh] sm:max-h-[calc(100vh-2rem)] sm:animate-slide-fade-in sm:rounded-2xl ${width}`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink-900/15 dark:bg-white/15 sm:hidden" aria-hidden="true" />
        <div
          className={`flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-3 sm:px-6 sm:pb-4 sm:pt-6 ${
            header ? "border-b border-ink-900/[0.07] dark:border-white/[0.06] sm:pb-5" : ""
          }`}
        >
          {header || <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight text-ink-900 dark:text-ink-50">{title}</h2>}
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-700 dark:hover:bg-white/[0.08] dark:hover:text-ink-50 sm:p-1.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 ${header ? "pt-5" : ""} ${
            footer ? "pb-5" : "pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6"
          }`}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-ink-900/[0.07] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 dark:border-white/[0.06] sm:px-6 sm:pb-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

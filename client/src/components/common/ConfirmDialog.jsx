import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";

// The styled stand-in for window.confirm on destructive actions. Mounted once
// by ConfirmProvider; call sites reach it through useConfirm().
export default function ConfirmDialog({
  open,
  title,
  subject,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  icon: Icon = Trash2,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const messageId = useId();
  const panelRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const returnFocus = document.activeElement;
    // The safe choice takes focus, so a stray Enter keeps the item.
    cancelRef.current?.focus();

    // Capture on window runs ahead of the document-level Escape listener of
    // any Modal underneath (task, event, folder); stopping it here keeps one
    // Escape from dismissing both the dialog and the form it was opened from.
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      const buttons = panelRef.current?.querySelectorAll("button");
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const inside = panelRef.current.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      returnFocus?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;

  // z-[70] clears Modal (z-50) and Select's menu (z-[60]), since most of these
  // dialogs open on top of an edit form.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm motion-safe:animate-fade-in dark:bg-ink-950/70"
        onClick={onCancel}
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        className="card danger-wash relative w-full max-w-sm overflow-hidden bg-white/90 px-6 pb-6 pt-7 text-center shadow-glass-lg motion-safe:animate-slide-fade-in dark:bg-ink-900/80"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-600 ring-8 ring-red-500/[0.06] dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/[0.08]">
          <Icon className="h-6 w-6" />
        </div>

        <h2 id={titleId} className="mt-5 text-lg font-semibold tracking-tight text-ink-900 dark:text-ink-50">
          {title}
        </h2>

        {subject && (
          <div className="mt-3 flex justify-center">
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-ink-200/80 bg-white/70 px-3 py-1 text-sm font-medium text-ink-800 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-ink-100">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
              <span className="truncate">{subject}</span>
            </span>
          </div>
        )}

        {message && (
          <p id={messageId} className="mt-3 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            {message}
          </p>
        )}

        {/* Stacked on phones, with Cancel at the bottom like an action sheet;
            side by side there, "Delete document" wraps onto two lines. */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn-secondary sm:flex-1">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="btn-danger sm:flex-1">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

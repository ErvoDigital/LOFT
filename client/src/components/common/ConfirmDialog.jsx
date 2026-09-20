import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";

// The styled stand-in for window.confirm on destructive actions. Mounted once
// by ConfirmProvider; call sites reach it through useConfirm().
//
// `option`, when given ({ label, description }), adds one opt-in checkbox for
// a second, harsher version of the same action — deleting a chat's messages
// for everyone on top of removing it from your own list, say. It starts
// unchecked, so the gentler action is what a hurried Enter gets.
export default function ConfirmDialog({
  open,
  title,
  subject,
  message,
  option,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  icon: Icon = Trash2,
  onConfirm,
  onCancel,
}) {
  const [optionChecked, setOptionChecked] = useState(false);
  const titleId = useId();
  const messageId = useId();
  const panelRef = useRef(null);
  const cancelRef = useRef(null);

  // Each opening starts from the safe default, so a checkbox ticked last time
  // can't silently carry into the next delete.
  useEffect(() => {
    if (open) setOptionChecked(false);
  }, [open]);

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
      const buttons = panelRef.current?.querySelectorAll("button, input");
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

        {option && (
          <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink-200/80 bg-white/70 p-3 text-left dark:border-white/[0.08] dark:bg-white/[0.04]">
            <input
              type="checkbox"
              checked={optionChecked}
              onChange={(e) => setOptionChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink-800 dark:text-ink-100">{option.label}</span>
              {option.description && (
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-500 dark:text-ink-400">{option.description}</span>
              )}
            </span>
          </label>
        )}

        {/* Stacked on phones, with Cancel at the bottom like an action sheet;
            side by side above that, where Cancel takes only the width its own
            word needs so the longer action label keeps the rest and stays on
            one line. */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn-secondary sm:flex-none">
            {cancelLabel}
          </button>
          <button type="button" onClick={() => onConfirm(optionChecked)} className="btn-danger sm:flex-1">
            {option && optionChecked && option.confirmLabel ? option.confirmLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

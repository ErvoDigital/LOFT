import { AlertCircle } from "lucide-react";

export default function FileFailureNotice({ failure, filename, onRetry, onDismiss, busy = false }) {
  if (!failure) return null;
  return (
    <div role="alert" className="flex w-full items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-400/20 dark:bg-amber-500/10">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink-800 dark:text-ink-100">{failure.title}</p>
        {filename && <p className="mt-0.5 break-words text-xs text-ink-500 dark:text-ink-400">{filename}</p>}
        <p className="mt-1 text-ink-600 dark:text-ink-300">{failure.message}</p>
        {(failure.canRetry && onRetry || onDismiss) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {failure.canRetry && onRetry && <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={onRetry}>{failure.action === "preview" ? "Try preview again" : "Try download again"}</button>}
            {onDismiss && <button type="button" className="btn-ghost text-xs" onClick={onDismiss}>Dismiss</button>}
          </div>
        )}
      </div>
    </div>
  );
}

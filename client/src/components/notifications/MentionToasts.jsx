import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AtSign, X } from "lucide-react";
import { useNotifications } from "../../context/NotificationsContext.jsx";

// Keep in sync with the `toast-shrink` animation duration in tailwind.config.js.
const TOAST_SECONDS = 6;

function MentionToast({ toast, onDismiss }) {
  const navigate = useNavigate();
  const { markRead } = useNotifications();
  const [remaining, setRemaining] = useState(TOAST_SECONDS);

  useEffect(() => {
    const interval = setInterval(() => setRemaining((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (remaining <= 0) onDismiss(toast.id);
  }, [remaining, toast.id, onDismiss]);

  return (
    <div
      role="alert"
      onClick={() => {
        markRead(toast.id);
        onDismiss(toast.id);
        if (toast.link) navigate(toast.link);
      }}
      className="animate-toast-in relative flex w-80 cursor-pointer items-start gap-2.5 overflow-hidden rounded-xl border border-ink-200 bg-white p-3 pb-3.5 shadow-panel"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
        <AtSign className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-800">{toast.title}</p>
        {toast.body && <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{toast.body}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(toast.id);
          }}
          className="rounded p-0.5 text-ink-300 hover:bg-ink-100 hover:text-ink-600"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <span className="text-[10px] font-medium tabular-nums text-ink-300">{remaining}s</span>
      </div>
      <div className="animate-toast-shrink absolute inset-x-0 bottom-0 h-0.5 bg-brand-500/70" />
    </div>
  );
}

// Instant top-right pop-up for @mentions, on top of the persistent bell
// entry NotificationsBell.jsx already renders. Mounted once in
// NotificationsProvider so it's live on every authenticated route.
export default function MentionToasts() {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <MentionToast key={t.id} toast={t} onDismiss={dismissToast} />
      ))}
    </div>
  );
}

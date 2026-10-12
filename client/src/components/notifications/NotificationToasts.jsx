import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AtSign, Bell, CalendarDays, CheckSquare, Users, Video, X } from "lucide-react";
import { useNotifications } from "../../context/NotificationsContext.jsx";

const TOAST_DURATION = 8000;
const notificationIcons = { MENTION: AtSign, TASK_ASSIGNED: CheckSquare, TASK_REMINDER: CheckSquare, EVENT_INVITE: CalendarDays, EVENT_REMINDER: CalendarDays, MEETING_STARTED: Video, WORKSPACE_INVITE: Users };

export function NotificationToast({ toast, onDismiss }) {
  const navigate = useNavigate();
  const { markRead } = useNotifications();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(TOAST_DURATION);
  const paused = hovered || focused;

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timeout = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => { clearTimeout(timeout); remaining.current = Math.max(0, remaining.current - (Date.now() - started)); };
  }, [paused, toast.id, onDismiss]);

  const Icon = notificationIcons[toast.type] || Bell;
  return (
    <article data-notification-id={toast.id} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }} className="pointer-events-auto relative w-full shrink-0 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-panel motion-safe:animate-toast-in dark:border-ink-700 dark:bg-ink-800">
      <div className="flex items-start gap-1 p-2">
        <button type="button" aria-label={`Open notification: ${toast.title}`} onClick={() => { markRead(toast.id); onDismiss(toast.id); if (toast.link?.startsWith("/") && !toast.link.startsWith("//")) navigate(toast.link); }} className="flex min-w-0 flex-1 items-start gap-3 rounded-xl p-2 text-left transition-colors hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-ink-700/50">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300"><Icon className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-400">New notification</span><span className="block line-clamp-2 break-words text-sm font-semibold text-ink-800 dark:text-ink-100">{toast.title}</span>{toast.body && <span className="mt-1 block line-clamp-2 break-words text-xs leading-relaxed text-ink-500 dark:text-ink-400">{toast.body}</span>}</span>
        </button>
        <button type="button" onClick={() => onDismiss(toast.id)} aria-label={`Dismiss notification: ${toast.title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-ink-700 dark:hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-500/10"><div className="h-full bg-brand-500/70 motion-safe:animate-toast-shrink" style={{ animationDuration: `${TOAST_DURATION}ms`, animationPlayState: paused ? "paused" : "running" }} /></div>
    </article>
  );
}

export default function NotificationToasts() {
  const { toasts, dismissToast } = useNotifications();
  const { pathname } = useLocation();
  const raised = /\/(chat|meeting)$|\/docs\/[^/]+$/.test(pathname);

  return (
    <section aria-label="Notification pop-ups" aria-live="polite" aria-relevant="additions" aria-atomic="false" className={`pointer-events-none absolute right-3 z-40 flex w-[min(24rem,calc(100%-1.5rem))] max-h-[calc(100dvh-14rem)] flex-col gap-2 overflow-y-auto overscroll-contain sm:right-5 sm:max-h-[calc(100dvh-16rem)] print:hidden ${raised ? "bottom-[calc(max(4.75rem,var(--chat-composer-clearance,0px),var(--meeting-controls-clearance,0px))+4.5rem)] sm:bottom-[calc(max(6rem,var(--chat-composer-clearance,0px),var(--meeting-controls-clearance,0px))+4.75rem)]" : "bottom-[max(5.5rem,env(safe-area-inset-bottom))] sm:bottom-24"}`}>
      {toasts.map((toast) => <NotificationToast key={toast.id} toast={toast} onDismiss={dismissToast} />)}
    </section>
  );
}

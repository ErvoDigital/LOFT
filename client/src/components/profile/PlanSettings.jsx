import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { updateProfile } from "../../api/users.js";
import { apiErrorMessage } from "../../api/client.js";

export default function PlanSettings() {
  const { user, setUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const enabled = user?.aiPriorityEnabled !== false;
  async function toggle() {
    if (pending.current) return;
    pending.current = true; setSaving(true); setError("");
    try {
      const updated = await updateProfile({ aiPriorityEnabled: !enabled });
      setUser((current) => current?.id === updated.id ? { ...current, aiPriorityEnabled: updated.aiPriorityEnabled } : current);
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { pending.current = false; setSaving(false); }
  }
  return <section className="card p-5 sm:p-6" aria-label="My Plan settings">
    <h2 className="flex items-center gap-2 text-base font-semibold"><Sparkles className="h-4 w-4 text-brand-600" />My Plan</h2>
    <div className="mt-4 flex items-start justify-between gap-4">
      <div><p id="ai-priority-label" className="text-sm font-medium">Automatic AI priority analysis</p><p id="ai-priority-description" className="mt-1 text-sm text-ink-500 dark:text-ink-400">Lofty analyzes your tasks, deadlines, effort, and meetings to prioritize your plan and explain what to do next. Enabled by default. You can always reorder tasks and edit their details yourself.</p><p className="mt-2 text-xs text-ink-500">This preference is saved to your account.</p></div>
      <button type="button" role="switch" aria-checked={enabled} aria-labelledby="ai-priority-label" aria-describedby="ai-priority-description" disabled={saving} onClick={toggle} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:opacity-60 ${enabled ? "bg-brand-600" : "bg-ink-300 dark:bg-ink-600"}`}><span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} /></button>
    </div>
    {saving && <p role="status" className="mt-3 text-sm text-ink-500">Saving preference…</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
  </section>;
}

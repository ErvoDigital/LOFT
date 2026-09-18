import { Sparkles } from "lucide-react";

export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300/60 py-12 text-center dark:border-white/10">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500 dark:text-brand-300">
        {icon || <Sparkles className="h-5 w-5" />}
      </div>
      <p className="font-medium text-ink-700 dark:text-ink-200">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

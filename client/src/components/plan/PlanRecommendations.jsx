import { Sparkles } from "lucide-react";

export default function PlanRecommendations({ analysis, tasks, onOpen }) {
  const { data: result, busy, error, retry } = analysis;
  return <section aria-label="Lofty priority analysis" className="card min-w-0 space-y-3 p-4 sm:p-5">
    <h3 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-brand-600" />Lofty?s priority analysis</h3>
    {busy && <p role="status" className="text-sm text-ink-500">Analyzing task details, deadlines, effort, and meetings to prioritize your plan?</p>}
    {error && <div role="alert" className="text-sm text-ink-600 dark:text-ink-300"><p>{error}</p><button type="button" className="mt-2 min-h-11 text-brand-700 underline dark:text-brand-300" onClick={retry}>Retry analysis</button></div>}
    {result?.enabled === false && <p className="text-sm text-ink-500">Automatic AI priority analysis is off in your personal settings.</p>}
    {result && result.enabled !== false && <div className="space-y-3"><p className="text-sm leading-relaxed">{result.summary}</p><ol className="space-y-3">{result.items.map((item, index) => <li key={item.taskId} className="rounded-xl border border-ink-200 p-3 text-sm dark:border-ink-700">
      <button type="button" className="text-left font-semibold text-brand-700 hover:underline dark:text-brand-300" onClick={() => { const task = tasks.find((task) => task.id === item.taskId); if (task) onOpen(task); }}>{index + 1}. {item.title}</button>
      <p className="mt-1 text-xs text-ink-500">{item.workspaceName}</p><p className="mt-2 leading-relaxed"><span className="font-semibold">Why now: </span>{item.reason}</p><p className="mt-1 leading-relaxed"><span className="font-semibold">Next step: </span>{item.nextStep}</p>
    </li>)}</ol></div>}
    <p className="text-xs text-ink-500">You can reorder tasks and edit their details directly below. Your changes take precedence.</p>
    {result?.eligibleTaskCount > result?.analyzedTaskCount && <p className="text-xs text-ink-500">Lofty analyzed {result.analyzedTaskCount} focus tasks. Other active tasks retain their existing priority order.</p>}
  </section>;
}

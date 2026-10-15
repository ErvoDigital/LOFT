import { useEffect, useState } from "react";
import { getRecommendations } from "../api/plan.js";

const cache = new Map();
const TTL = 10 * 60000;
export function planAnalysisKey({ userId, plan, capacity, manual, timeZone }) {
  return JSON.stringify({ userId, capacity, manual, timeZone, day: new Date().toLocaleDateString("en-CA"),
    tasks: plan?.tasks.map(({ score, ...task }) => task), events: plan?.events, conflicts: plan?.conflicts });
}

// Coalesce edits and realtime updates; semantically identical refreshes reuse
// analysis instead of making another paid request. Manual moves remain owned
// by the page and cannot be replaced by a delayed model response.
export default function usePlanAnalysis({ userId, enabled, plan, capacity, manual }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Manila";
  const key = planAnalysisKey({ userId, plan, capacity, manual, timeZone });
  const [state, setState] = useState({ key: null, data: null, busy: false, error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled || !plan?.tasks.length) { setState({ key, data: null, busy: false, error: "" }); return; }
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < TTL) { setState({ key, data: cached.data, busy: false, error: "" }); return; }
    const controller = new AbortController();
    let retryTimer;
    setState({ key, data: null, busy: true, error: "" });
    const timer = setTimeout(async () => {
      try {
        const data = await getRecommendations({ capacity, timeZone, manual }, controller.signal);
        if (controller.signal.aborted) return;
        if (data.enabled !== false) cache.set(key, { at: Date.now(), data });
        if (cache.size > 30) cache.delete(cache.keys().next().value);
        setState({ key, data, busy: false, error: "" });
      } catch (err) {
        if (!controller.signal.aborted) setState({ key, data: null, busy: false, error: err?.response?.status === 429
          ? "Lofty is busy and will retry shortly. Your tasks are still available to edit."
          : "Lofty couldn't analyze your priorities right now. Your tasks are still available to reorder and edit." });
        if (!controller.signal.aborted && err?.response?.status === 429) retryTimer = setTimeout(() => setRetry((value) => value + 1), 30000);
      }
    }, 700);
    return () => { clearTimeout(timer); clearTimeout(retryTimer); controller.abort(); };
  }, [key, enabled, retry]);
  return { ...(state.key === key && enabled ? state : { data: null, busy: enabled && Boolean(plan?.tasks.length), error: "" }), retry: () => { cache.delete(key); setRetry((value) => value + 1); } };
}

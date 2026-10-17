// Serialize writes per document. An edit arriving during a write keeps dirty
// set, and a failed write retains the state and schedules another attempt.
export async function saveDocumentEntry(entry, { write, scheduleRetry, onSaved, onError }) {
  if (entry.saving) {
    await entry.saving;
    if (entry.dirty) return saveDocumentEntry(entry, { write, scheduleRetry, onSaved, onError });
    return;
  }
  if (!entry.dirty) return;
  entry.dirty = false;
  entry.saving = (async () => {
    try {
      const result = await write();
      entry.saveFailures = 0;
      await onSaved?.(result, entry.dirty);
    } catch (error) {
      if (error.code === "P2025") { entry.dirty = false; return; }
      entry.dirty = true;
      entry.saveFailures = Math.min((entry.saveFailures || 0) + 1, 5);
      onError?.(error);
      scheduleRetry(Math.min(30_000, 1000 * 2 ** entry.saveFailures));
    }
  })();
  try { await entry.saving; }
  finally { entry.saving = null; }
}

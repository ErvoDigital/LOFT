// Where the assistant's replies come from, shared by the chat panel and the
// voice bubble so both answer the same way. Until OpenClaw is wired up
// (docs/ai/README.md), every question gets this reply, so neither surface
// claims to have done something it didn't.
const PLACEHOLDER_REPLY =
  "I'm not connected yet, so I can't act on that. Once LOFT's OpenClaw integration is live, I'll answer from your tasks, calendar and messages.";
const REPLY_DELAY_MS = 700;

// Resolves with the reply text. Aborting `signal` rejects instead, for a
// question the user has moved on from.
export function askAssistant(question, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(PLACEHOLDER_REPLY), REPLY_DELAY_MS);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}

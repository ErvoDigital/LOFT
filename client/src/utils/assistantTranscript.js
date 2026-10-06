// The speech endpoint supplies no word timestamps. Use the measured audio
// duration to spread words across playback, keeping the original spacing.
export function spokenReplyAt(reply, currentTime, duration) {
  const words = Array.from(reply.matchAll(/\S+\s*/gu));
  if (!words.length) return "";
  const progress = Number.isFinite(duration) && duration > 0
    ? Math.max(0, Math.min(1, (Number.isFinite(currentTime) ? currentTime : 0) / duration))
    : 0;
  if (progress >= 1) return reply;
  const position = progress * reply.length;
  let end = words[0].index + words[0][0].length;
  for (const word of words) {
    if (word.index > position) break;
    end = word.index + word[0].length;
  }
  return reply.slice(0, end).trimEnd();
}

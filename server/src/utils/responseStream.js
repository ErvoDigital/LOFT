import { ApiError } from "./ApiError.js";

// SSE frames and UTF-8 characters can straddle network chunks. Only the
// terminal response authorizes tool execution; deltas are display-only.
export async function readResponseStream(response, onProgress) {
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError(502, "OpenClaw returned an invalid response stream.");
  const decoder = new TextDecoder();
  let pending = "";
  let terminal;
  try {
    while (!terminal) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let boundary;
      while ((boundary = /\r?\n\r?\n/.exec(pending))) {
        const frame = pending.slice(0, boundary.index);
        pending = pending.slice(boundary.index + boundary[0].length);
        const raw = frame.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (!raw || raw === "[DONE]") continue;
        let event;
        try { event = JSON.parse(raw); }
        catch { throw new ApiError(502, "OpenClaw returned an invalid response stream."); }
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          onProgress({ type: "delta", text: event.delta });
        }
        if (["response.completed", "response.failed", "response.incomplete"].includes(event.type)) {
          terminal = event.response;
          if (!terminal) throw new ApiError(502, "OpenClaw returned an invalid response stream.");
          if (event.type !== "response.completed") throw new ApiError(502, "OpenClaw could not complete the response. Try a shorter request.");
          break;
        }
      }
      if (pending.length > 1024 * 1024) throw new ApiError(502, "OpenClaw returned an oversized response stream.");
      if (done) break;
    }
    if (!terminal) throw new ApiError(502, "OpenClaw stopped before completing the response. Please try again.");
    return terminal;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

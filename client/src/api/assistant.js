import { api } from "./client.js";

export const assistantStatus = () => api.get("/assistant/status").then((r) => r.data);
function streamError(message, status = 502) {
  return Object.assign(new Error(message), { response: { status, data: { error: message } } });
}

export async function readAssistantReply(stream, onProgress) {
  const reader = stream?.getReader();
  if (!reader) throw streamError("The assistant returned an invalid response stream.");
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let newline;
      while ((newline = pending.indexOf("\n")) !== -1 || (done && pending.trim())) {
        const line = newline === -1 ? pending : pending.slice(0, newline);
        pending = newline === -1 ? "" : pending.slice(newline + 1);
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); }
        catch { throw streamError("The assistant returned an invalid response stream."); }
        if (!event || typeof event !== "object" || (event.type === "delta" && typeof event.text !== "string")) throw streamError("The assistant returned an invalid response stream.");
        if (event.type === "error") throw streamError(event.error, event.status);
        if (event.type === "result") {
          if (typeof event.reply !== "string" || !Array.isArray(event.actions)) throw streamError("The assistant returned an invalid response.");
          return { reply: event.reply, actions: event.actions };
        }
        if (event.type === "delta" || event.type === "reset") onProgress(event);
      }
      if (pending.length > 1024 * 1024) throw streamError("The assistant returned an oversized response stream.");
      if (done) throw streamError("The assistant stopped before completing the reply. Please try again.");
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function sendAssistantMessage(body, signal, onProgress) {
  if (!onProgress) return api.post("/assistant/message", body, { signal, timeout: 100000 }).then((r) => r.data);
  try {
    // Axios's fetch adapter keeps the existing auth/401 interceptors while
    // exposing the body before the server has finished generating the reply.
    const response = await api.post("/assistant/message", body, {
      signal, timeout: 100000, adapter: "fetch", responseType: "stream", headers: { Accept: "application/x-ndjson" },
    });
    const contentType = response.headers?.get?.("content-type") || response.headers?.["content-type"] || "";
    if (!contentType.includes("application/x-ndjson")) return new Response(response.data).json();
    return await readAssistantReply(response.data, onProgress);
  } catch (err) {
    // HTTP failures still contain JSON even when the requested response is a stream.
    if (err.response?.data?.getReader) {
      try { err.response.data = await new Response(err.response.data).json(); } catch { /* Preserve non-JSON failures. */ }
    }
    throw err;
  }
}
export const confirmAssistantAction = (token) => api.post("/assistant/confirm", { token }).then((r) => r.data);
export const transcribeAssistantAudio = (audioBlob, { workspaceId } = {}, signal) => {
  const form = new FormData();
  form.append("audio", audioBlob, "assistant-voice.webm");
  if (workspaceId) form.append("workspaceId", workspaceId);
  return api.post("/assistant/transcribe", form, { signal, timeout: 70000 }).then((r) => r.data);
};
export async function speakAssistantReply(text, { workspaceId, voice } = {}, signal) {
  try {
    const response = await api.post("/assistant/speak", { text, ...(workspaceId ? { workspaceId } : {}), ...(voice ? { voice } : {}) }, { signal, timeout: 70000, responseType: "blob" });
    return response.data;
  } catch (err) {
    // Axios also returns JSON failures as blobs for an audio request.
    // Decode them so the user sees the actual speech error and can retry.
    if (err.response?.data instanceof Blob) {
      try { err.response.data = JSON.parse(await err.response.data.text()); } catch { /* Keep the original error if the response was not JSON. */ }
    }
    throw err;
  }
}

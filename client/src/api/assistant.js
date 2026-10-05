import { api } from "./client.js";

export const assistantStatus = () => api.get("/assistant/status").then((r) => r.data);
export const sendAssistantMessage = (body, signal) => api.post("/assistant/message", body, { signal, timeout: 100000 }).then((r) => r.data);
export const confirmAssistantAction = (token) => api.post("/assistant/confirm", { token }).then((r) => r.data);
export const transcribeAssistantAudio = (audioBlob, { workspaceId } = {}, signal) => {
  const form = new FormData();
  form.append("audio", audioBlob, "assistant-voice.webm");
  if (workspaceId) form.append("workspaceId", workspaceId);
  return api.post("/assistant/transcribe", form, { signal, timeout: 70000 }).then((r) => r.data);
};
export const speakAssistantReply = (text, { workspaceId, voice } = {}, signal) => (
  api.post("/assistant/speak", { text, ...(workspaceId ? { workspaceId } : {}), ...(voice ? { voice } : {}) }, { signal, timeout: 70000, responseType: "blob" }).then((r) => r.data)
);

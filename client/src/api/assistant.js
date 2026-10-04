import { api } from "./client.js";

export const assistantStatus = () => api.get("/assistant/status").then((r) => r.data);
export const sendAssistantMessage = (body, signal) => api.post("/assistant/message", body, { signal, timeout: 100000 }).then((r) => r.data);
export const confirmAssistantAction = (token) => api.post("/assistant/confirm", { token }).then((r) => r.data);

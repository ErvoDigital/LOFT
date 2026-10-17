import { api } from "./client.js";

export const getPlan = (capacity, signal) => api.get("/plan", { params: capacity == null ? {} : { capacity }, signal }).then((r) => r.data);
export const getRecommendations = (data, signal) => api.post("/plan/recommendations", data, { signal, timeout: 100000 }).then((r) => r.data);
export const savePreferences = (preferences) => api.patch("/plan/preferences", preferences).then((r) => r.data.preferences);

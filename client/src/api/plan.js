import { api } from "./client.js";

export const getPlan = (capacity = 6, signal) => api.get("/plan", { params: { capacity }, signal }).then((r) => r.data);
export const getRecommendations = (data, signal) => api.post("/plan/recommendations", data, { signal, timeout: 100000 }).then((r) => r.data);

import { api } from "./client.js";
export const globalSearch = (q, workspaceId, signal) => api.get("/search", { params: { q, ...(workspaceId ? { workspaceId } : {}) }, signal }).then((response) => response.data.results);

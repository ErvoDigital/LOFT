import { api } from "./client.js";
export const getMeetingConfig = () => api.get("/meetings/ice").then((r) => r.data);

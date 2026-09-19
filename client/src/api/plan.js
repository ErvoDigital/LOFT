import { api } from "./client.js";

export const getPlan = () => api.get("/plan").then((r) => r.data);

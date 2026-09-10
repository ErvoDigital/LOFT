import { api } from "./client.js";

export const getPlan = (dailyCapacityHours) =>
  api.get("/plan", { params: { capacity: dailyCapacityHours } }).then((r) => r.data);

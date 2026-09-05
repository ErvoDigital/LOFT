import { api } from "./client.js";

export const login = (email, password) => api.post("/auth/login", { email, password }).then((r) => r.data);
export const register = (name, email, password) =>
  api.post("/auth/register", { name, email, password }).then((r) => r.data);
export const fetchMe = () => api.get("/auth/me").then((r) => r.data.user);
export const forgotPassword = (email) => api.post("/auth/forgot-password", { email }).then((r) => r.data);
export const resetPassword = (token, password) =>
  api.post("/auth/reset-password", { token, password }).then((r) => r.data);

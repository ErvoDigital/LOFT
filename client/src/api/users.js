import { api } from "./client.js";

export const updateProfile = (data) => api.patch("/users/me", data).then((r) => r.data.user);
export const changePassword = (currentPassword, newPassword) =>
  api.post("/users/me/change-password", { currentPassword, newPassword }).then((r) => r.data);
export const searchUsers = (q) => api.get("/users/search", { params: { q } }).then((r) => r.data.users);

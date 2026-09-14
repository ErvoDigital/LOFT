import { api } from "./client.js";

export const updateProfile = (data) => api.patch("/users/me", data).then((r) => r.data.user);
export const sendPasswordChangeCode = () => api.post("/users/me/password-change/send-code").then((r) => r.data);
export const verifyPasswordChangeCode = (code) =>
  api.post("/users/me/password-change/verify-code", { code }).then((r) => r.data);
export const changePassword = (code, newPassword) =>
  api.post("/users/me/change-password", { code, newPassword }).then((r) => r.data);
export const linkGoogle = (credential) =>
  api.post("/users/me/link-google", { credential }).then((r) => r.data.user);
export const unlinkGoogle = () => api.post("/users/me/unlink-google").then((r) => r.data.user);
export const searchUsers = (q) => api.get("/users/search", { params: { q } }).then((r) => r.data.users);

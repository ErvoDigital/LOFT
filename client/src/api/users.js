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
export const getUserProfile = (userId, workspaceId) =>
  api.get(`/users/${userId}/profile`, { params: workspaceId ? { workspaceId } : undefined }).then((r) => r.data);

// Following is mutual: requesting only creates a pending ask, and the two
// only appear in each other's people lists once it's accepted.
export const listMyFollows = () => api.get("/users/me/follows").then((r) => r.data);
export const requestFollow = (userId) => api.post(`/users/${userId}/follow`).then((r) => r.data.state);
export const acceptFollow = (userId) => api.post(`/users/${userId}/follow/accept`).then((r) => r.data.state);
// Declines a request, cancels one you sent, or unfollows — same endpoint.
export const removeFollow = (userId) => api.delete(`/users/${userId}/follow`).then((r) => r.data.state);

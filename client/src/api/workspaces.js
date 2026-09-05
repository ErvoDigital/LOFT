import { api } from "./client.js";

export const listWorkspaces = () => api.get("/workspaces").then((r) => r.data.workspaces);
export const createWorkspace = (data) => api.post("/workspaces", data).then((r) => r.data.workspace);
export const getWorkspace = (id) => api.get(`/workspaces/${id}`).then((r) => r.data.workspace);
export const updateWorkspace = (id, data) => api.patch(`/workspaces/${id}`, data).then((r) => r.data.workspace);
export const joinWorkspace = (inviteCode) => api.post("/workspaces/join", { inviteCode }).then((r) => r.data.workspace);
export const leaveWorkspace = (id) => api.post(`/workspaces/${id}/leave`).then((r) => r.data);
export const updateMemberRole = (workspaceId, memberId, role) =>
  api.patch(`/workspaces/${workspaceId}/members/${memberId}`, { role }).then((r) => r.data.member);
export const removeMember = (workspaceId, memberId) =>
  api.delete(`/workspaces/${workspaceId}/members/${memberId}`).then((r) => r.data);

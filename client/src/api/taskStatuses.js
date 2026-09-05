import { api } from "./client.js";

export const listTaskStatuses = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/task-statuses`).then((r) => r.data.statuses);
export const createTaskStatus = (workspaceId, data) =>
  api.post(`/workspaces/${workspaceId}/task-statuses`, data).then((r) => r.data.status);
export const updateTaskStatus = (workspaceId, statusId, data) =>
  api.patch(`/workspaces/${workspaceId}/task-statuses/${statusId}`, data).then((r) => r.data.status);
export const deleteTaskStatus = (workspaceId, statusId) =>
  api.delete(`/workspaces/${workspaceId}/task-statuses/${statusId}`).then((r) => r.data);

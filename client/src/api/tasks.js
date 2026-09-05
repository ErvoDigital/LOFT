import { api } from "./client.js";

export const listMyTasks = () => api.get("/tasks").then((r) => r.data.tasks);
export const listWorkspaceTasks = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/tasks`).then((r) => r.data.tasks);
export const createTask = (workspaceId, data) =>
  api.post(`/workspaces/${workspaceId}/tasks`, data).then((r) => r.data.task);
export const updateTask = (workspaceId, taskId, data) =>
  api.patch(`/workspaces/${workspaceId}/tasks/${taskId}`, data).then((r) => r.data.task);
export const deleteTask = (workspaceId, taskId) =>
  api.delete(`/workspaces/${workspaceId}/tasks/${taskId}`).then((r) => r.data);

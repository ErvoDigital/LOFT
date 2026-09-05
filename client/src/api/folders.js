import { api } from "./client.js";

export const listFolders = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/folders`).then((r) => r.data.folders);

export const createFolder = (workspaceId, data) =>
  api.post(`/workspaces/${workspaceId}/folders`, data).then((r) => r.data.folder);

export const updateFolder = (workspaceId, folderId, data) =>
  api.patch(`/workspaces/${workspaceId}/folders/${folderId}`, data).then((r) => r.data.folder);

export const deleteFolder = (workspaceId, folderId) =>
  api.delete(`/workspaces/${workspaceId}/folders/${folderId}`).then((r) => r.data);

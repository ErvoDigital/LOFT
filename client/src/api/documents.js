import { api } from "./client.js";

export const listDocuments = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/documents`).then((r) => r.data.documents);

export const getDocument = (workspaceId, documentId) =>
  api.get(`/workspaces/${workspaceId}/documents/${documentId}`).then((r) => r.data.document);

export const createDocument = (workspaceId, data = {}) =>
  api.post(`/workspaces/${workspaceId}/documents`, data).then((r) => r.data.document);

export const renameDocument = (workspaceId, documentId, title) =>
  api.patch(`/workspaces/${workspaceId}/documents/${documentId}`, { title }).then((r) => r.data.document);

export const deleteDocument = (workspaceId, documentId) =>
  api.delete(`/workspaces/${workspaceId}/documents/${documentId}`).then((r) => r.data);

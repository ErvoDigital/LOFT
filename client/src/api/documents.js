import { api } from "./client.js";
export const listRevisions = (workspaceId, documentId) => api.get(`/workspaces/${workspaceId}/documents/${documentId}/revisions`).then((r) => r.data.revisions);
export const getRevision = (workspaceId, documentId, revisionId) => api.get(`/workspaces/${workspaceId}/documents/${documentId}/revisions/${revisionId}`).then((r) => r.data.revision);
export const createRevision = (workspaceId, documentId, content) => api.post(`/workspaces/${workspaceId}/documents/${documentId}/revisions`, { content }).then((r) => r.data.revision);

export const listDocuments = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/documents`).then((r) => r.data.documents);

export const getDocument = (workspaceId, documentId) =>
  api.get(`/workspaces/${workspaceId}/documents/${documentId}`).then((r) => r.data.document);

export const createDocument = (workspaceId, data = {}) =>
  api.post(`/workspaces/${workspaceId}/documents`, data).then((r) => r.data.document);

export const renameDocument = (workspaceId, documentId, title) =>
  api.patch(`/workspaces/${workspaceId}/documents/${documentId}`, { title }).then((r) => r.data.document);

export const updateDocumentAccess = (workspaceId, documentId, data) =>
  api.patch(`/workspaces/${workspaceId}/documents/${documentId}/access`, data).then((r) => r.data.document);

export const deleteDocument = (workspaceId, documentId) =>
  api.delete(`/workspaces/${workspaceId}/documents/${documentId}`).then((r) => r.data);

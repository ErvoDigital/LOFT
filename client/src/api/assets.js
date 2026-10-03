import { api } from "./client.js";

export const listAssets = (workspaceId) => api.get(`/workspaces/${workspaceId}/assets`).then((r) => r.data.assets);

export const uploadAsset = (workspaceId, file, folderId, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  if (folderId) form.append("folderId", folderId);
  return api
    .post(`/workspaces/${workspaceId}/assets`, form, {
      onUploadProgress: onProgress,
    })
    .then((r) => r.data.asset);
};

// Uploads a file shared in a chat message — the server resolves the right
// "chat files" folder for that conversation itself (see
// uploadChatAttachment in assets.controller.js), so the caller only needs
// to say which conversation this belongs to.
export const uploadChatAttachment = (workspaceId, conversationId, file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  form.append("conversationId", conversationId);
  return api
    .post(`/workspaces/${workspaceId}/assets/chat-attachment`, form, {
      onUploadProgress: onProgress,
    })
    .then((r) => r.data.asset);
};

export const uploadVersion = (workspaceId, assetId, file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post(`/workspaces/${workspaceId}/assets/${assetId}/versions`, form, {
      onUploadProgress: onProgress,
    })
    .then((r) => r.data.asset);
};

export const listTaskAttachments = (workspaceId, taskId) =>
  api.get(`/workspaces/${workspaceId}/tasks/${taskId}/attachments`).then((r) => r.data.assets);

export const uploadTaskAttachment = (workspaceId, taskId, file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post(`/workspaces/${workspaceId}/tasks/${taskId}/attachments`, form, {
      onUploadProgress: onProgress,
    })
    .then((r) => r.data.asset);
};

export const deleteTaskAttachment = (workspaceId, taskId, assetId) =>
  api.delete(`/workspaces/${workspaceId}/tasks/${taskId}/attachments/${assetId}`).then((r) => r.data);

export const mergeAssets = (workspaceId, targetAssetId, sourceAssetId) =>
  api.post(`/workspaces/${workspaceId}/assets/${targetAssetId}/merge`, { sourceAssetId }).then((r) => r.data.asset);

export const deleteAsset = (workspaceId, assetId) =>
  api.delete(`/workspaces/${workspaceId}/assets/${assetId}`).then((r) => r.data);

export const moveAsset = (workspaceId, assetId, folderId) =>
  api.patch(`/workspaces/${workspaceId}/assets/${assetId}/folder`, { folderId }).then((r) => r.data.asset);

export const getVersionDownloadUrl = (workspaceId, assetId, version) =>
  api
    .get(`/workspaces/${workspaceId}/assets/${assetId}/versions/${version.id}/download`)
    .then((response) => {
      const url = response.data?.url;
      let protocol;
      try {
        protocol = new URL(url).protocol;
      } catch {
        throw new Error("File download link is unavailable");
      }
      if (protocol !== "https:" && protocol !== "http:") {
        throw new Error("File download link is unavailable");
      }
      return url;
    });

// Authorization happens at the LOFT API first. The returned presigned URL is
// then fetched directly so the browser sends the app's Origin to S3. LOFT's
// bearer token is never forwarded to object storage.
export async function fetchVersionBlob(workspaceId, assetId, version) {
  const signedUrl = await getVersionDownloadUrl(workspaceId, assetId, version);
  let response;
  try {
    response = await fetch(signedUrl, { credentials: "omit" });
  } catch {
    throw new Error("File could not be downloaded");
  }
  if (!response.ok) throw new Error("File could not be downloaded");
  return response.blob();
}

export async function downloadVersion(workspaceId, assetId, version) {
  const blob = await fetchVersionBlob(workspaceId, assetId, version);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = version.originalName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

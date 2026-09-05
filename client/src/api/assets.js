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

export const uploadVersion = (workspaceId, assetId, file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post(`/workspaces/${workspaceId}/assets/${assetId}/versions`, form, {
      onUploadProgress: onProgress,
    })
    .then((r) => r.data.asset);
};

export const mergeAssets = (workspaceId, targetAssetId, sourceAssetId) =>
  api.post(`/workspaces/${workspaceId}/assets/${targetAssetId}/merge`, { sourceAssetId }).then((r) => r.data.asset);

export const deleteAsset = (workspaceId, assetId) =>
  api.delete(`/workspaces/${workspaceId}/assets/${assetId}`).then((r) => r.data);

export const moveAsset = (workspaceId, assetId, folderId) =>
  api.patch(`/workspaces/${workspaceId}/assets/${assetId}/folder`, { folderId }).then((r) => r.data.asset);

// Shared by download and preview — both need the raw bytes, auth'd the same
// way; only what's done with the resulting blob differs.
export const fetchVersionBlob = (workspaceId, assetId, version) =>
  api
    .get(`/workspaces/${workspaceId}/assets/${assetId}/versions/${version.id}/download`, { responseType: "blob" })
    .then((r) => r.data);

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

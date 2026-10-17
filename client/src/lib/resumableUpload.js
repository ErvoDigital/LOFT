import { api } from "../api/client.js";

export async function uploadResumable(workspaceId, file, { folderId, assetId, onProgress, signal } = {}) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const checksum = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  let userId = "";
  try { userId = JSON.parse(atob(localStorage.getItem("loft_token").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub; } catch { /* The API still enforces authentication. */ }
  const key = `synctayo:upload:${userId}:${workspaceId}:${assetId || folderId || "root"}:${checksum}`;
  const base = `/workspaces/${workspaceId}/assets/uploads`;
  let sessionId;
  try { sessionId = localStorage.getItem(key); } catch { /* Resume within this session remains possible. */ }
  let status;
  if (sessionId) {
    try { status = (await api.get(`${base}/${sessionId}`, { signal })).data; }
    catch (error) { if (![404, 410].includes(error.response?.status)) throw error; sessionId = null; }
  }
  if (!sessionId) {
    status = (await api.post(base, { name: file.name, mimeType: file.type, size: file.size, checksum, ...(folderId ? { folderId } : {}), ...(assetId ? { assetId } : {}) }, { signal })).data;
    sessionId = status.id;
    try { localStorage.setItem(key, sessionId); } catch { /* Upload can still finish. */ }
  }
  const uploaded = new Map((status.parts || []).map((part) => [part.number, part.size]));
  let loaded = [...uploaded.values()].reduce((sum, value) => sum + value, 0);
  onProgress?.({ loaded, total: file.size });
  if (!status.completedAssetId && !status.objectCompleted) {
    for (let number = 1; number <= Math.ceil(file.size / status.partSize); number++) {
      if (uploaded.has(number)) continue;
      const { url } = (await api.get(`${base}/${sessionId}/parts/${number}`, { signal })).data;
      const part = file.slice((number - 1) * status.partSize, number * status.partSize);
      // Never forward the app's Authorization header to object storage.
      const response = await fetch(url, { method: "PUT", body: part, credentials: "omit", signal });
      if (!response.ok) throw new Error("Upload paused. Select the same file to resume.");
      loaded += part.size; onProgress?.({ loaded, total: file.size });
    }
  }
  const { asset } = (await api.post(`${base}/${sessionId}/complete`, {}, { signal, timeout: 120000 })).data;
  try { localStorage.removeItem(key); } catch { /* A completed session is idempotent. */ }
  return asset;
}

import * as Y from "yjs";

// Recovery data is opened only after API and socket authorization.
export async function connectDocumentRecovery(userId, documentId, ydoc, onStatus = () => {}) {
  if (typeof indexedDB === "undefined") return { close() {} };
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("synctayo-document-recovery", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("documents");
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const key = `${userId}:${documentId}`;
  let timer, closed = false;
  try {
    const snapshot = await new Promise((resolve, reject) => { const request = db.transaction("documents").objectStore("documents").get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    if (snapshot) Y.applyUpdate(ydoc, new Uint8Array(snapshot));
  } catch { onStatus("Recovery could not be loaded on this device."); }
  const persist = () => {
    if (closed) return;
    try {
      const tx = db.transaction("documents", "readwrite");
      tx.objectStore("documents").put(Y.encodeStateAsUpdate(ydoc), key);
      tx.oncomplete = () => onStatus(""); tx.onerror = () => onStatus("Offline recovery is unavailable. Keep this tab open until changes are saved.");
    } catch { onStatus("Offline recovery is unavailable. Keep this tab open until changes are saved."); }
  };
  const update = () => { clearTimeout(timer); timer = setTimeout(persist, 300); };
  ydoc.on("update", update); persist();
  return { close() { clearTimeout(timer); ydoc.off("update", update); persist(); closed = true; db.close(); } };
}

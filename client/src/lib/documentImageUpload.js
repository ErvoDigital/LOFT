// Images are embedded as base64 data URIs directly in the Yjs document
// content (not uploaded to workspace Storage) — the assets download route
// requires an Authorization header, which a plain <img src> can't send, and
// there's no public/static file route to point at instead. Embedding keeps
// images part of the same CRDT sync/persistence path as everything else,
// so they show up for every collaborator automatically with zero extra
// plumbing. Capped in size so a large photo doesn't bloat the doc's synced
// state for everyone in the room.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export function fileToDataUri(file) {
  if (file.size > MAX_IMAGE_BYTES) {
    return Promise.reject(new Error("Image is too large (max 3MB) — images are embedded directly in the document."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function pickImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

// Center-crops to a square and downsizes before encoding, so a phone photo
// doesn't turn into a multi-MB data URI stored on the user or workspace row (see
// server/src/utils/imageDataUrl.js). JPEG flattens transparency to black, so
// logos pass type "image/webp" (browsers that can't encode WebP fall back to PNG).
export function resizeImageToDataUrl(file, { size = 256, quality = 0.85, type = "image/jpeg" } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL(type, quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

import { useEffect, useState } from "react";
import { File as FileIcon } from "lucide-react";
import Modal from "../common/Modal.jsx";
import Spinner from "../common/Spinner.jsx";
import * as assetsApi from "../../api/assets.js";

export default function PreviewModal({ open, onClose, workspaceId, assetId, version, name, onDownload }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !version) return undefined;
    let objectUrl;
    let cancelled = false;
    setUrl(null);
    setError("");

    assetsApi
      .fetchVersionBlob(workspaceId, assetId, version)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setError("Couldn't load this file."));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, version, workspaceId, assetId]);

  if (!open) return null;

  const mimeType = version?.mimeType || "";
  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  const loading = !url && !error;

  return (
    <Modal open={open} onClose={onClose} title={name} width="max-w-3xl">
      <div className="flex min-h-64 items-center justify-center">
        {loading && <Spinner />}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {url && isImage && <img src={url} alt={name} className="max-h-[70vh] w-full rounded-lg object-contain" />}
        {url && isVideo && <video src={url} controls className="max-h-[70vh] w-full rounded-lg" />}
        {url && !isImage && !isVideo && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-ink-100 text-ink-400">
              <FileIcon className="h-6 w-6" />
            </span>
            <p className="text-sm text-ink-500">No inline preview for this file type.</p>
            <button className="btn-primary" onClick={onDownload}>
              Download to view
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

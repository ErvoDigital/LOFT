import { useEffect, useRef, useState } from "react";
import { File as FileIcon } from "lucide-react";
import Modal from "../common/Modal.jsx";
import Spinner from "../common/Spinner.jsx";
import * as assetsApi from "../../api/assets.js";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function PreviewModal({ open, onClose, workspaceId, assetId, version, name, onDownload }) {
  const [url, setUrl] = useState(null);
  const [docxReady, setDocxReady] = useState(false);
  const [error, setError] = useState("");
  const docxContainerRef = useRef(null);

  const mimeType = version?.mimeType || "";
  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  const isPdf = mimeType === "application/pdf";
  const isDocx = mimeType === DOCX_MIME;

  useEffect(() => {
    if (!open || !version) return undefined;
    let objectUrl;
    let cancelled = false;
    setUrl(null);
    setDocxReady(false);
    setError("");

    assetsApi
      .fetchVersionBlob(workspaceId, assetId, version)
      .then(async (blob) => {
        if (cancelled) return;
        if (mimeType === DOCX_MIME) {
          // docx-preview renders straight into a container element rather
          // than handing back a URL, so it skips the object-URL path
          // entirely (unlike image/video/PDF below, which just point a
          // native element at the blob).
          const { renderAsync } = await import("docx-preview");
          if (cancelled || !docxContainerRef.current) return;
          docxContainerRef.current.innerHTML = "";
          await renderAsync(blob, docxContainerRef.current, undefined, {
            className: "docx-preview",
            inWrapper: true,
            ignoreHeight: true,
          });
          if (!cancelled) setDocxReady(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setError("Couldn't load this file."));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, version, workspaceId, assetId, mimeType]);

  if (!open) return null;

  const loading = !error && !url && !docxReady;

  return (
    <Modal open={open} onClose={onClose} title={name} width={isDocx || isPdf ? "max-w-4xl" : "max-w-3xl"}>
      <div className="flex min-h-64 items-center justify-center">
        {loading && <Spinner />}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {url && isImage && <img src={url} alt={name} className="max-h-[70vh] w-full rounded-lg object-contain" />}
        {url && isVideo && <video src={url} controls className="max-h-[70vh] w-full rounded-lg" />}
        {url && isPdf && (
          <iframe src={url} title={name} className="h-[75vh] w-full rounded-lg border border-ink-200 bg-white" />
        )}
        {isDocx && !error && (
          <div
            ref={docxContainerRef}
            className={`max-h-[75vh] w-full overflow-auto rounded-lg border border-ink-200 bg-ink-100 p-4 ${docxReady ? "" : "hidden"}`}
          />
        )}
        {url && !isImage && !isVideo && !isPdf && !isDocx && (
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

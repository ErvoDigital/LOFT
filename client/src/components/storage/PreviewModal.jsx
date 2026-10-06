import { useEffect, useRef, useState } from "react";
import { File as FileIcon } from "lucide-react";
import Modal from "../common/Modal.jsx";
import Spinner from "../common/Spinner.jsx";
import * as assetsApi from "../../api/assets.js";
import { previewMimeType, readOfficePreview } from "../../lib/filePreview.js";
import OfficeContentPreview from "./OfficeContentPreview.jsx";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024;

export default function PreviewModal({ open, onClose, workspaceId, assetId, version, name, onDownload }) {
  const [url, setUrl] = useState(null);
  const [docxReady, setDocxReady] = useState(false);
  const [textPreview, setTextPreview] = useState(null);
  const [officePreview, setOfficePreview] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const docxContainerRef = useRef(null);

  const mimeType = previewMimeType(version);
  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  const isPdf = mimeType === "application/pdf";
  const isDocx = mimeType === DOCX_MIME;
  const isXlsx = mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const isPptx = mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const isText = ["text/plain", "text/markdown", "text/csv"].includes(mimeType.split(";")[0].trim().toLowerCase());

  useEffect(() => {
    if (!open || !version) return undefined;
    let objectUrl;
    let cancelled = false;
    setUrl(null);
    setDocxReady(false);
    setTextPreview(null);
    setOfficePreview(null);
    setError("");

    assetsApi
      .fetchVersionBlob(workspaceId, assetId, version)
      .then(async (blob) => {
        if (cancelled) return;
        if (isXlsx || isPptx) {
          const preview = await readOfficePreview(blob, isXlsx ? "xlsx" : "pptx");
          if (!cancelled) setOfficePreview(preview);
          return;
        }
        if (isText) {
          const text = await blob.slice(0, MAX_TEXT_PREVIEW_BYTES).text();
          if (!cancelled) setTextPreview({ text, truncated: blob.size > MAX_TEXT_PREVIEW_BYTES });
          return;
        }
        if (isDocx) {
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
        // S3 objects uploaded with a generic content type still need the right
        // MIME for the browser's PDF and image viewers.
        objectUrl = URL.createObjectURL(blob.type === mimeType ? blob : new Blob([blob], { type: mimeType }));
        setUrl(objectUrl);
      })
      .catch((err) => !cancelled && setError(err?.response?.data?.error || err.message || "Couldn't load this file."));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, version, workspaceId, assetId, mimeType, isText, isDocx, isXlsx, isPptx]);

  async function download() {
    if (downloading) return;
    setDownloading(true);
    try {
      await onDownload();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Couldn't download this file.");
    } finally {
      setDownloading(false);
    }
  }

  if (!open) return null;

  const loading = !error && !url && !docxReady && textPreview === null && officePreview === null;

  return (
    <Modal open={open} onClose={onClose} title={name} width={isDocx || isPdf || isXlsx || isPptx ? "max-w-4xl" : "max-w-3xl"} footer={
      <div className="flex flex-wrap items-center justify-end gap-3">
        {url && isPdf && <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary">Open PDF in a new tab</a>}
        <button type="button" className="btn-primary" disabled={downloading} onClick={download}>{downloading ? "Downloading…" : "Download"}</button>
      </div>
    }>
      <div className="flex min-h-64 items-center justify-center">
        {loading && <Spinner />}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {officePreview && !error && <OfficeContentPreview key={version.id} preview={officePreview} />}
        {textPreview !== null && !error && (
          <div className="w-full">
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-ink-200 bg-ink-50 p-4 font-mono text-sm text-ink-800 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100">{textPreview.text || "This file is empty."}</pre>
            {textPreview.truncated && <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">Showing the first 1 MB. Download the file to view all its contents.</p>}
          </div>
        )}
        {url && isImage && <img src={url} alt={name} className="max-h-[70vh] w-full rounded-lg object-contain" />}
        {url && isVideo && <video src={url} controls className="max-h-[70vh] w-full rounded-lg" />}
        {url && isPdf && (
          <iframe src={url} title={name} className="h-[75vh] w-full rounded-lg border border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-800" />
        )}
        {isDocx && !error && (
          <div
            ref={docxContainerRef}
            className={`max-h-[75vh] w-full overflow-auto rounded-lg border border-ink-200 bg-ink-100 p-4 dark:border-ink-700 dark:bg-ink-900 ${docxReady ? "" : "hidden"}`}
          />
        )}
        {url && !isImage && !isVideo && !isPdf && !isDocx && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-ink-100 text-ink-400 dark:bg-ink-700">
              <FileIcon className="h-6 w-6" />
            </span>
            <p className="text-sm text-ink-500">No inline preview for this file type.</p>
            <button type="button" className="btn-primary" disabled={downloading} onClick={download}>
              Download to view
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

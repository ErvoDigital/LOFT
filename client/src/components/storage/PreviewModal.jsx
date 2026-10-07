import { useEffect, useRef, useState } from "react";
import { File as FileIcon } from "lucide-react";
import Modal from "../common/Modal.jsx";
import Spinner from "../common/Spinner.jsx";
import * as assetsApi from "../../api/assets.js";
import { previewMimeType, readOfficePreview } from "../../lib/filePreview.js";
import { fileFailure } from "../../lib/fileFeedback.js";
import OfficeContentPreview from "./OfficeContentPreview.jsx";
import FileFailureNotice from "./FileFailureNotice.jsx";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024;

export default function PreviewModal(props) {
  if (!props.open) return null;
  // File changes and closing the modal discard pending UI state from the last file.
  return <FilePreview key={props.workspaceId + ":" + props.assetId + ":" + props.version?.id} {...props} />;
}

function FilePreview({ open, onClose, workspaceId, assetId, version, name, onDownload }) {
  const [url, setUrl] = useState(null);
  const [docxReady, setDocxReady] = useState(false);
  const [textPreview, setTextPreview] = useState(null);
  const [officePreview, setOfficePreview] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadFailure, setDownloadFailure] = useState(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [previewFailure, setPreviewFailure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const docxContainerRef = useRef(null);
  const downloadPending = useRef(false);

  const mimeType = previewMimeType(version);
  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  const isPdf = mimeType === "application/pdf";
  const isDocx = mimeType === DOCX_MIME;
  const isXlsx = mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const isPptx = mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const isText = ["text/plain", "text/markdown", "text/csv"].includes(mimeType);
  const pdfSupported = !isPdf || typeof navigator === "undefined" || navigator.pdfViewerEnabled !== false;
  const supported = (isImage || isVideo || isPdf || isDocx || isXlsx || isPptx || isText) && pdfSupported;
  const missing = !version?.id || !workspaceId || !assetId;
  const failure = missing ? fileFailure({ code: "FILE_MISSING" }, "preview") : previewFailure;
  const downloadBlocked = missing || (failure && !failure.canRetry) || (downloadFailure && !downloadFailure.canRetry);

  useEffect(() => {
    if (missing || !supported) return;
    let objectUrl;
    let cancelled = false;
    const controller = new AbortController();
    setUrl(null);
    setDocxReady(false);
    setTextPreview(null);
    setOfficePreview(null);
    setPreviewFailure(null);
    setLoading(true);

    assetsApi.fetchVersionBlob(workspaceId, assetId, version, controller.signal)
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
          const { renderAsync } = await import("docx-preview");
          if (cancelled || !docxContainerRef.current) return;
          docxContainerRef.current.innerHTML = "";
          await renderAsync(blob, docxContainerRef.current, undefined, { className: "docx-preview", inWrapper: true, ignoreHeight: true });
          if (!cancelled) setDocxReady(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob.type === mimeType ? blob : new Blob([blob], { type: mimeType }));
        setUrl(objectUrl);
      })
      .catch((err) => { if (!cancelled) setPreviewFailure(fileFailure(err, "preview")); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [version, workspaceId, assetId, mimeType, isText, isDocx, isXlsx, isPptx, missing, supported, attempt]);

  async function download() {
    if (downloadPending.current || downloadBlocked) return;
    downloadPending.current = true;
    setDownloading(true);
    setDownloadFailure(null);
    setDownloadStarted(false);
    try {
      await (onDownload ? onDownload() : assetsApi.downloadVersion(workspaceId, assetId, version));
      setDownloadStarted(true);
    } catch (err) {
      setDownloadFailure(fileFailure(err));
    } finally {
      downloadPending.current = false;
      setDownloading(false);
    }
  }

  const mediaFailed = () => setPreviewFailure(fileFailure(null, "preview"));
  const retryPreview = () => { setPreviewFailure(null); setAttempt((value) => value + 1); };

  return (
    <Modal open={open} onClose={onClose} title={name || version?.originalName || "File preview"} width={isDocx || isPdf || isXlsx || isPptx ? "max-w-4xl" : "max-w-3xl"} footer={
      <div className="flex flex-wrap items-center justify-end gap-3">
        {downloadStarted && <p role="status" className="mr-auto text-xs text-ink-500 dark:text-ink-400">Download started. Check your browser's Downloads.</p>}
        {url && isPdf && <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary">Open PDF in a new tab</a>}
        <button type="button" className="btn-primary" disabled={downloading || Boolean(downloadBlocked)} onClick={download}>{downloading ? "Preparing download…" : "Download file"}</button>
      </div>
    }>
      <div className="space-y-4">
        {downloadFailure && <FileFailureNotice failure={downloadFailure} onRetry={download} onDismiss={() => setDownloadFailure(null)} busy={downloading} />}
        <div className="flex min-h-64 items-center justify-center">
          {failure ? (
            <FileFailureNotice failure={failure} onRetry={retryPreview} />
          ) : !supported ? (
            <div className="flex max-w-md flex-col items-center gap-3 py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-ink-100 text-ink-400 dark:bg-ink-700"><FileIcon className="h-6 w-6" aria-hidden="true" /></span>
              <h3 className="text-base font-medium text-ink-800 dark:text-ink-100">{pdfSupported ? "Preview isn't available for this file type" : "Your browser can't preview this PDF"}</h3>
              <p className="text-sm text-ink-500 dark:text-ink-400">You can still download the file and open it in an app that supports it.</p>
              <button type="button" className="btn-secondary" disabled={downloading || Boolean(downloadBlocked)} onClick={download}>Download to open</button>
            </div>
          ) : (
            <div className="w-full">
              {loading && <div role="status" className="flex min-h-64 flex-col items-center justify-center gap-3"><Spinner /><p className="text-sm text-ink-500 dark:text-ink-400">Loading preview…</p></div>}
              {officePreview && <OfficeContentPreview key={version.id} preview={officePreview} />}
              {textPreview !== null && <div>
                <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-ink-200 bg-ink-50 p-4 font-mono text-sm text-ink-800 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100">{textPreview.text || "This file is empty."}</pre>
                {textPreview.truncated && <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">Showing the first 1 MB. Download the file to view all its contents.</p>}
              </div>}
              {url && isImage && <img src={url} alt={name || version.originalName} onError={mediaFailed} className="max-h-[70vh] w-full rounded-lg object-contain" />}
              {url && isVideo && <video src={url} controls onError={mediaFailed} className="max-h-[70vh] w-full rounded-lg" />}
              {url && isPdf && <div>
                <iframe src={url} title={name || version.originalName} onError={mediaFailed} className="h-[75vh] w-full rounded-lg border border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-800" />
                <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">If the PDF looks blank or won't display, open it in a new tab or download it below.</p>
              </div>}
              {isDocx && <div ref={docxContainerRef} className={"max-h-[75vh] w-full overflow-auto rounded-lg border border-ink-200 bg-ink-100 p-4 dark:border-ink-700 dark:bg-ink-900 " + (docxReady ? "" : "hidden")} />}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

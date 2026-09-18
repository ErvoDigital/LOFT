import { useState } from "react";
import { Download, Eye, FolderInput, Trash2 } from "lucide-react";
import Avatar from "../common/Avatar.jsx";
import { ASSET_DRAG_TYPE } from "./dragTypes.js";
import { FileIcon, formatSize, timeAgo } from "../../lib/fileIcons.jsx";

export default function AssetCard({ asset, canManage, onDropFile, onMergeDrop, onDownload, onPreview, onMove, onDelete, uploadProgress, materializing }) {
  const [expanded, setExpanded] = useState(false);
  const [dragState, setDragState] = useState(null); // "merge" | "version" | null

  const latest = asset.latestVersion;
  const isMultiVersion = asset.versionCount > 1;

  function handleDragStart(e) {
    e.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id);
    e.dataTransfer.setData("text/plain", asset.name);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes(ASSET_DRAG_TYPE)) setDragState("merge");
    else if (e.dataTransfer.types.includes("Files")) setDragState("version");
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragState(null);
    const sourceAssetId = e.dataTransfer.getData(ASSET_DRAG_TYPE);
    if (sourceAssetId && sourceAssetId !== asset.id) {
      onMergeDrop(sourceAssetId);
      return;
    }
    if (e.dataTransfer.files?.length > 0) {
      onDropFile(e.dataTransfer.files[0]);
    }
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragState(null)}
      onDrop={handleDrop}
      className={`card card-hover relative cursor-grab p-4 active:cursor-grabbing ${
        dragState === "merge"
          ? "border-brand-400 bg-brand-500/10 ring-2 ring-brand-400/40"
          : dragState === "version"
            ? "border-accent-300 bg-accent-500/10 ring-2 ring-accent-400/40"
            : ""
      } ${materializing ? "animate-slide-fade-in" : ""}`}
    >
      {isMultiVersion && (
        <span className="absolute right-3 top-3 rounded-full brand-mark px-2 py-0.5 text-[11px] font-semibold text-white shadow-glow-sm">
          V{latest.version}
        </span>
      )}

      <button
        type="button"
        onClick={() => onPreview(latest)}
        className="mb-2 flex w-full items-start gap-2.5 pr-8 text-left"
        title="Preview"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
          <FileIcon mimeType={latest?.mimeType} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-800 hover:text-brand-600 dark:text-ink-100 dark:hover:text-brand-400">{asset.name}</p>
          <p className="text-xs text-ink-400">
            {latest && formatSize(latest.size)} · {timeAgo(asset.updatedAt)}
          </p>
        </div>
      </button>

      <div className="mb-3 flex items-center gap-2">
        <Avatar name={asset.uploadedBy.name} color={asset.uploadedBy.avatarColor} size={20} />
        <span className="text-xs text-ink-400">{asset.uploadedBy.name}</span>
      </div>

      {dragState && (
        <p className={`mb-2 text-xs font-medium ${dragState === "merge" ? "text-brand-600 dark:text-brand-400" : "text-accent-700 dark:text-accent-300"}`}>
          {dragState === "merge" ? "Drop to merge as a new version" : "Drop to add as a new version"}
        </p>
      )}

      {uploadProgress !== undefined && (
        <div className="mb-2">
          <p className="mb-1 text-xs font-medium text-ink-400">Uploading… {uploadProgress}%</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-900/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-accent-500 transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <button onClick={() => onPreview(latest)} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Preview
          </button>
          {isMultiVersion && (
            <button onClick={() => setExpanded((e) => !e)} className="font-medium text-ink-500 hover:underline">
              {expanded ? "Hide versions" : `${asset.versionCount} versions`}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDownload(latest)}
            title="Download"
            aria-label="Download"
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          {canManage && (
            <>
              <button
                onClick={() => onMove(asset)}
                title="Move to folder"
                aria-label="Move to folder"
                className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
              >
                <FolderInput className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(asset.id)}
                title="Delete"
                aria-label="Delete"
                className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-1.5 border-t border-ink-900/10 pt-2.5 dark:border-white/10">
          {asset.versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink-600 dark:text-ink-300">V{v.version}</span>
              <span className="truncate px-2 text-ink-400">{formatSize(v.size)} · {timeAgo(v.createdAt)}</span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => onPreview(v)}
                  title="Preview"
                  aria-label="Preview"
                  className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDownload(v)}
                  title="Download"
                  aria-label="Download"
                  className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

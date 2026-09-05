import { useState } from "react";
import { File, Film, Image, Music, FileText } from "lucide-react";
import Avatar from "../common/Avatar.jsx";
import { ASSET_DRAG_TYPE } from "./dragTypes.js";

function FileIcon({ mimeType, className }) {
  if (!mimeType) return <File className={className} />;
  if (mimeType.startsWith("video/")) return <Film className={className} />;
  if (mimeType.startsWith("image/")) return <Image className={className} />;
  if (mimeType.startsWith("audio/")) return <Music className={className} />;
  if (mimeType === "application/pdf") return <FileText className={className} />;
  return <File className={className} />;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AssetCard({ asset, canManage, onDropFile, onMergeDrop, onDownload, onPreview, onMove, onDelete, uploadProgress }) {
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
      className={`card relative cursor-grab p-4 transition-colors active:cursor-grabbing ${
        dragState === "merge" ? "border-brand-400 bg-brand-50" : dragState === "version" ? "border-accent-300 bg-accent-50" : ""
      }`}
    >
      {isMultiVersion && (
        <span className="absolute right-3 top-3 rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow-soft">
          V{latest.version}
        </span>
      )}

      <button
        type="button"
        onClick={() => onPreview(latest)}
        className="mb-2 flex w-full items-start gap-2.5 pr-8 text-left"
        title="Preview"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
          <FileIcon mimeType={latest?.mimeType} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-800 hover:text-brand-600">{asset.name}</p>
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
        <p className={`mb-2 text-xs font-medium ${dragState === "merge" ? "text-brand-600" : "text-accent-700"}`}>
          {dragState === "merge" ? "Drop to merge as a new version" : "Drop to add as a new version"}
        </p>
      )}

      {uploadProgress !== undefined && (
        <div className="mb-2">
          <p className="mb-1 text-xs font-medium text-ink-400">Uploading… {uploadProgress}%</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-accent-500 transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <div className="flex gap-3">
          <button onClick={() => onPreview(latest)} className="font-medium text-brand-600 hover:underline">
            Preview
          </button>
          <button onClick={() => onDownload(latest)} className="font-medium text-ink-500 hover:underline">
            Download
          </button>
          {isMultiVersion && (
            <button onClick={() => setExpanded((e) => !e)} className="font-medium text-ink-500 hover:underline">
              {expanded ? "Hide versions" : `${asset.versionCount} versions`}
            </button>
          )}
        </div>
        {canManage && (
          <div className="flex gap-3">
            <button onClick={() => onMove(asset)} className="font-medium text-ink-500 hover:underline">
              Move
            </button>
            <button onClick={() => onDelete(asset.id)} className="font-medium text-red-500 hover:underline">
              Delete
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-3 space-y-1.5 border-t border-ink-200 pt-2.5">
          {asset.versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink-600">V{v.version}</span>
              <span className="truncate px-2 text-ink-400">{formatSize(v.size)} · {timeAgo(v.createdAt)}</span>
              <div className="flex shrink-0 gap-2.5">
                <button onClick={() => onPreview(v)} className="font-medium text-brand-600 hover:underline">
                  Preview
                </button>
                <button onClick={() => onDownload(v)} className="font-medium text-ink-500 hover:underline">
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

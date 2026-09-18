import { useState } from "react";
import { Lock, Pencil, Trash2 } from "lucide-react";
import Avatar from "../common/Avatar.jsx";
import { ASSET_DRAG_TYPE } from "./dragTypes.js";

// The folder silhouette — tab on the left stepping up from the body, drawn as
// one closed path so the tab/body join has no seam the way two stacked
// translucent boxes would. Coordinates are absolute, so the card is a fixed
// 288x148 box and the viewBox matches it 1:1 (no corner-radius skew).
const FOLDER_PATH =
  "M12 6h80a12 12 0 0 1 9.6 4.8l7.2 9.6a12 12 0 0 0 9.6 4.8H276a12 12 0 0 1 12 12v78a12 12 0 0 1-12 12H12a12 12 0 0 1-12-12V18A12 12 0 0 1 12 6Z";

export default function FolderCard({ folder, canManage, onOpen, onEdit, onDelete, onAssetDrop, onFileDrop, materializing, glowing }) {
  const [dragOver, setDragOver] = useState(false);
  const restricted = folder.visibility === "RESTRICTED";
  // Who the card shows: for a restricted folder the people who can actually
  // reach it, otherwise just whoever made it.
  const people = restricted && folder.members?.length ? folder.members : [folder.createdBy];

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes(ASSET_DRAG_TYPE) || e.dataTransfer.types.includes("Files")) {
      setDragOver(true);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const assetId = e.dataTransfer.getData(ASSET_DRAG_TYPE);
    if (assetId) {
      onAssetDrop(assetId, folder.id);
      return;
    }
    if (e.dataTransfer.files?.length > 0) {
      onFileDrop(folder.id, e.dataTransfer.files[0]);
    }
  }

  const surface = dragOver
    ? "fill-brand-500/20 stroke-brand-400"
    : "fill-white/70 stroke-ink-200 group-hover:fill-white/90 group-hover:stroke-brand-400/70 dark:fill-white/[0.05] dark:stroke-white/[0.16] dark:group-hover:fill-white/[0.09] dark:group-hover:stroke-brand-400/50";

  return (
    <div className={materializing ? "animate-materialize" : ""}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => onOpen(folder.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(folder.id);
          }
        }}
        className={`group relative h-32 w-72 cursor-pointer focus:outline-none ${glowing ? "animate-glow-pulse-drop" : ""}`}
      >
        <svg
          viewBox="0 0 288 128"
          className="absolute inset-0 h-full w-full transition-colors group-focus-visible:stroke-brand-400"
          aria-hidden="true"
        >
          <path d={FOLDER_PATH} strokeWidth="1" className={`transition-colors ${surface}`} />
        </svg>

        <div className="relative flex h-full flex-col px-4 pb-4 pt-8">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{folder.name}</p>
              {dragOver ? (
                <p className="truncate text-xs font-medium text-brand-600 dark:text-brand-300">Drop to move here</p>
              ) : (
                <p className="truncate text-xs text-ink-400">Created by {folder.createdBy?.name || "—"}</p>
              )}
            </div>
            {canManage && (
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(folder);
                  }}
                  title="Edit folder"
                  aria-label="Edit folder"
                  className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-brand-500/10 hover:text-brand-600 dark:hover:bg-white/[0.08] dark:hover:text-brand-300"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(folder.id);
                  }}
                  title="Delete folder"
                  aria-label="Delete folder"
                  className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-auto flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 gap-y-1">
              <span className="chip !px-2 !py-0.5 text-[11px]">
                {folder.assetCount} file{folder.assetCount === 1 ? "" : "s"}
              </span>
              {folder.subfolderCount > 0 && (
                <span className="chip !px-2 !py-0.5 text-[11px]">
                  {folder.subfolderCount} folder{folder.subfolderCount === 1 ? "" : "s"}
                </span>
              )}
              {restricted && (
                <span className="chip !border-accent-400/40 !px-2 !py-0.5 text-[11px] !text-accent-600 dark:!text-accent-300">
                  <Lock className="h-2.5 w-2.5" /> Restricted
                </span>
              )}
            </div>

            <div className="ml-auto flex shrink-0 items-center -space-x-1.5">
              {people.slice(0, 2).map(
                (p) =>
                  p && (
                    <span key={p.id} className="rounded-full ring-2 ring-white dark:ring-ink-900" title={p.name}>
                      <Avatar name={p.name} color={p.avatarColor} size={20} />
                    </span>
                  )
              )}
              {people.length > 2 && (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-900/10 text-[10px] font-semibold text-ink-500 ring-2 ring-white dark:bg-white/10 dark:text-ink-300 dark:ring-ink-900"
                  title={people.slice(2).map((p) => p.name).join(", ")}
                >
                  +{people.length - 2}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

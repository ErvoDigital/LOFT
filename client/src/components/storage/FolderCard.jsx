import { useState } from "react";
import { Folder as FolderIcon, Lock, Pencil, Trash2 } from "lucide-react";
import { ASSET_DRAG_TYPE } from "./dragTypes.js";

export default function FolderCard({ folder, canManage, onOpen, onEdit, onDelete, onAssetDrop, onFileDrop }) {
  const [dragOver, setDragOver] = useState(false);

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

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`card flex cursor-pointer items-center gap-3 p-4 transition-colors hover:border-brand-300 ${
        dragOver ? "border-brand-400 bg-brand-50" : ""
      }`}
      onClick={() => onOpen(folder.id)}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
        <FolderIcon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-ink-800">{folder.name}</p>
          {folder.visibility === "RESTRICTED" && <Lock className="h-3 w-3 shrink-0 text-accent-500" />}
        </div>
        {dragOver ? (
          <p className="text-xs font-medium text-brand-600">Drop to move here</p>
        ) : (
          <p className="text-xs text-ink-400">
            {folder.subfolderCount} folder{folder.subfolderCount === 1 ? "" : "s"} · {folder.assetCount} file
            {folder.assetCount === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {canManage && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(folder);
            }}
            title="Edit folder"
            aria-label="Edit folder"
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
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
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

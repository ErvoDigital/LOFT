import { Folder as FolderIcon } from "lucide-react";
import Modal from "../common/Modal.jsx";

function buildRows(folders, parentId = null, depth = 0, rows = []) {
  folders
    .filter((f) => f.parentId === parentId)
    .forEach((f) => {
      rows.push({ folder: f, depth });
      buildRows(folders, f.id, depth + 1, rows);
    });
  return rows;
}

export default function MoveToFolderModal({ open, onClose, folders, currentFolderId, onMove }) {
  const rows = buildRows(folders);

  function handlePick(folderId) {
    onMove(folderId);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Move to folder" width="max-w-sm">
      <div className="max-h-80 space-y-1 overflow-y-auto">
        <button
          onClick={() => handlePick(null)}
          disabled={currentFolderId === null}
          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium ${
            currentFolderId === null ? "cursor-default text-ink-300" : "text-ink-700 hover:bg-ink-50"
          }`}
        >
          Workspace root
        </button>
        {rows.map(({ folder, depth }) => (
          <button
            key={folder.id}
            onClick={() => handlePick(folder.id)}
            disabled={currentFolderId === folder.id}
            style={{ paddingLeft: `${10 + depth * 16}px` }}
            className={`flex w-full items-center gap-2 rounded-lg py-2 pr-2.5 text-left text-sm font-medium ${
              currentFolderId === folder.id ? "cursor-default text-ink-300" : "text-ink-700 hover:bg-ink-50"
            }`}
          >
            <FolderIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{folder.name}</span>
          </button>
        ))}
        {rows.length === 0 && <p className="px-2.5 py-2 text-sm text-ink-400">No folders yet.</p>}
      </div>
    </Modal>
  );
}

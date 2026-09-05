import { useEffect, useState } from "react";
import Modal from "../common/Modal.jsx";
import * as foldersApi from "../../api/folders.js";
import { apiErrorMessage } from "../../api/client.js";

export default function FolderModal({ open, onClose, workspaceId, members, parentId, folder, onSaved, onDeleted }) {
  const isEdit = !!folder;
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState("WORKSPACE");
  const [memberIds, setMemberIds] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (folder) {
      setName(folder.name);
      setVisibility(folder.visibility);
      setMemberIds(folder.members?.map((m) => m.id) || []);
    } else {
      setName("");
      setVisibility("WORKSPACE");
      setMemberIds([]);
    }
    setError("");
  }, [open, folder]);

  function toggleMember(id) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = { name, visibility, memberIds: visibility === "RESTRICTED" ? memberIds : [] };
      const saved = isEdit
        ? await foldersApi.updateFolder(workspaceId, folder.id, payload)
        : await foldersApi.createFolder(workspaceId, { ...payload, parentId });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this folder? It must be empty first.")) return;
    setLoading(true);
    try {
      await foldersApi.deleteFolder(workspaceId, folder.id);
      onDeleted(folder.id);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit folder" : "New folder"} width="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus maxLength={120} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600">Who can see this folder</label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setVisibility("WORKSPACE")}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                visibility === "WORKSPACE" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-500 hover:bg-ink-50"
              }`}
            >
              Everyone
            </button>
            <button
              type="button"
              onClick={() => setVisibility("RESTRICTED")}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                visibility === "RESTRICTED" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-500 hover:bg-ink-50"
              }`}
            >
              Restricted
            </button>
          </div>
        </div>
        {visibility === "RESTRICTED" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Who can view/download</label>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {members.map((m) => (
                <button
                  type="button"
                  key={m.user.id}
                  onClick={() => toggleMember(m.user.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    memberIds.includes(m.user.id) ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-500 hover:bg-ink-50"
                  }`}
                >
                  {m.user.name}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-400">You and workspace admins always have access.</p>
          </div>
        )}
        <div className="flex items-center gap-2 pt-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? "Saving…" : isEdit ? "Save changes" : "Create folder"}
          </button>
          {isEdit && (
            <button type="button" onClick={handleDelete} disabled={loading} className="btn-danger">
              Delete
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

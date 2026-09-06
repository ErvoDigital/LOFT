import { useEffect, useState } from "react";
import Modal from "../common/Modal.jsx";
import * as documentsApi from "../../api/documents.js";
import { apiErrorMessage } from "../../api/client.js";

export default function DocumentAccessModal({ open, onClose, workspaceId, members, document, onSaved }) {
  const [visibility, setVisibility] = useState("WORKSPACE");
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !document) return;
    setVisibility(document.visibility || "WORKSPACE");
    setAssigneeIds(document.assignees?.map((u) => u.id) || []);
    setError("");
  }, [open, document]);

  function toggleAssignee(id) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const saved = await documentsApi.updateDocumentAccess(workspaceId, document.id, {
        visibility,
        assigneeIds: visibility === "ASSIGNED" ? assigneeIds : [],
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Document access" width="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600">Who can open this document</label>
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
              onClick={() => setVisibility("ASSIGNED")}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                visibility === "ASSIGNED" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-500 hover:bg-ink-50"
              }`}
            >
              Only the assigned people
            </button>
          </div>
        </div>
        {visibility === "ASSIGNED" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Assigned to</label>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {members.map((m) => (
                <button
                  type="button"
                  key={m.user.id}
                  onClick={() => toggleAssignee(m.user.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    assigneeIds.includes(m.user.id) ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-500 hover:bg-ink-50"
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
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

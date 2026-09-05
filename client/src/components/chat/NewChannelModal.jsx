import { useEffect, useState } from "react";
import Modal from "../common/Modal.jsx";
import Avatar from "../common/Avatar.jsx";
import * as conversationsApi from "../../api/conversations.js";
import { apiErrorMessage } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function NewChannelModal({ open, onClose, workspaceId, members, onCreated }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [memberIds, setMemberIds] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setMemberIds([]);
      setError("");
    }
  }, [open]);

  function toggle(userId) {
    setMemberIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const conversation = await conversationsApi.createWorkspaceConversation(workspaceId, { title, memberIds });
      onCreated(conversation);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const others = members.filter((m) => m.user.id !== user.id);

  return (
    <Modal open={open} onClose={onClose} title="New group chat">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600">Channel name</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Design, Announcements" required autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600">Members</label>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-ink-200 bg-ink-50 p-1.5">
            {others.length === 0 && <p className="px-2 py-2 text-xs text-ink-400">No other members in this workspace yet.</p>}
            {others.map((m) => (
              <label key={m.user.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-white">
                <input type="checkbox" checked={memberIds.includes(m.user.id)} onChange={() => toggle(m.user.id)} className="accent-brand-600" />
                <Avatar name={m.user.name} color={m.user.avatarColor} src={m.user.avatarUrl} size={26} />
                <span className="text-sm text-ink-700">{m.user.name}</span>
              </label>
            ))}
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Creating…" : "Create channel"}
        </button>
      </form>
    </Modal>
  );
}

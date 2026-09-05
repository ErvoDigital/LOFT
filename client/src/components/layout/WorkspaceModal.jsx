import { useState } from "react";
import Modal from "../common/Modal.jsx";
import * as workspacesApi from "../../api/workspaces.js";
import { apiErrorMessage } from "../../api/client.js";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";
import { useNavigate } from "react-router-dom";

const TYPES = [
  { value: "school", label: "School" },
  { value: "work", label: "Work" },
  { value: "org", label: "Organization" },
  { value: "church", label: "Church" },
  { value: "other", label: "Other" },
];

const COLORS = ["#4F46E5", "#0EA5E9", "#059669", "#D97706", "#DB2777", "#64748B"];

export default function WorkspaceModal({ open, onClose }) {
  const [tab, setTab] = useState("create");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("school");
  const [color, setColor] = useState(COLORS[0]);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { refresh } = useWorkspaces();
  const navigate = useNavigate();

  function reset() {
    setName("");
    setDescription("");
    setType("school");
    setColor(COLORS[0]);
    setInviteCode("");
    setError("");
    setTab("create");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const workspace = await workspacesApi.createWorkspace({ name, description, type, color });
      await refresh();
      reset();
      onClose();
      navigate(`/workspaces/${workspace.id}/calendar`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const workspace = await workspacesApi.joinWorkspace(inviteCode.trim());
      await refresh();
      reset();
      onClose();
      navigate(`/workspaces/${workspace.id}/calendar`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add a workspace"
    >
      <div className="mb-4 flex rounded-lg bg-ink-100 p-1 text-sm">
        <button
          className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${tab === "create" ? "bg-white text-ink-800 shadow-soft" : "text-ink-500"}`}
          onClick={() => setTab("create")}
        >
          Create new
        </button>
        <button
          className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${tab === "join" ? "bg-white text-ink-800 shadow-soft" : "text-ink-500"}`}
          onClick={() => setTab("join")}
        >
          Join with code
        </button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {tab === "create" ? (
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Workspace name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CS 101, Marketing Team" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Description (optional)</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this group for?" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Type</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${type === t.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-500 hover:bg-ink-50"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-7 w-7 rounded-full ring-offset-2 ${color === c ? "ring-2 ring-ink-800" : ""}`}
                />
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating…" : "Create workspace"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Invite code</label>
            <input
              className="input uppercase tracking-widest"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="e.g. AB12CD3"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Joining…" : "Join workspace"}
          </button>
        </form>
      )}
    </Modal>
  );
}

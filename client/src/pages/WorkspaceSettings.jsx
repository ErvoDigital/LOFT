import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as workspacesApi from "../api/workspaces.js";
import { apiErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspaces } from "../context/WorkspaceContext.jsx";
import Avatar from "../components/common/Avatar.jsx";
import { RoleBadge } from "../components/common/Badges.jsx";
import Spinner from "../components/common/Spinner.jsx";

export default function WorkspaceSettings() {
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const { refresh } = useWorkspaces();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    workspacesApi.getWorkspace(workspaceId).then((w) => {
      setWorkspace(w);
      setName(w.name);
      setDescription(w.description || "");
    });
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!workspace) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const isAdmin = workspace.myRole === "ADMIN";

  async function saveDetails(e) {
    e.preventDefault();
    setError("");
    try {
      await workspacesApi.updateWorkspace(workspaceId, { name, description });
      setMessage("Workspace updated.");
      await refresh();
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function changeRole(memberId, role) {
    try {
      await workspacesApi.updateMemberRole(workspaceId, memberId, role);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function removeMember(memberId) {
    if (!confirm("Remove this member from the workspace?")) return;
    try {
      await workspacesApi.removeMember(workspaceId, memberId);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleLeave() {
    if (!confirm("Leave this workspace?")) return;
    await workspacesApi.leaveWorkspace(workspaceId);
    await refresh();
    navigate("/");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {message && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{message}</p>}

      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-ink-800">Workspace details</h2>
        <form onSubmit={saveDetails} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isAdmin} />
          </div>
          {isAdmin && (
            <button type="submit" className="btn-primary">
              Save changes
            </button>
          )}
        </form>
      </div>

      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-ink-800">Invite people</h2>
        <p className="mb-3 text-sm text-ink-400">Share this code so others can join.</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg border border-dashed border-ink-200 bg-ink-50 px-3 py-2 text-center text-lg font-semibold tracking-widest text-ink-700">
            {workspace.inviteCode}
          </code>
          <button
            className="btn-secondary"
            onClick={() => {
              navigator.clipboard.writeText(workspace.inviteCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-ink-800">Members ({workspace.members.length})</h2>
        <div className="space-y-2">
          {workspace.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink-50">
              <Avatar name={m.user.name} color={m.user.avatarColor} src={m.user.avatarUrl} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-700">
                  {m.user.name} {m.user.id === user.id && <span className="text-ink-400">(you)</span>}
                </p>
                <p className="truncate text-xs text-ink-400">{m.user.email}</p>
              </div>
              {isAdmin && m.user.id !== user.id ? (
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-md border border-ink-200 bg-white px-2 py-1 text-xs"
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value)}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="MEMBER">MEMBER</option>
                  </select>
                  <button onClick={() => removeMember(m.id)} className="text-xs font-medium text-red-500 hover:underline">
                    Remove
                  </button>
                </div>
              ) : (
                <RoleBadge role={m.role} />
              )}
            </div>
          ))}
        </div>
      </div>

      {workspace.ownerId !== user.id && (
        <div className="card border-red-100 p-6">
          <h2 className="mb-1 text-base font-semibold text-ink-800">Leave workspace</h2>
          <p className="mb-3 text-sm text-ink-400">You'll lose access to its calendar, tasks, and chat.</p>
          <button onClick={handleLeave} className="btn-danger">
            Leave {workspace.name}
          </button>
        </div>
      )}
    </div>
  );
}

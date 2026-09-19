import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LogOut, UserMinus } from "lucide-react";
import * as workspacesApi from "../api/workspaces.js";
import { apiErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspaces } from "../context/WorkspaceContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import Avatar from "../components/common/Avatar.jsx";
import { RoleBadge } from "../components/common/Badges.jsx";
import Spinner from "../components/common/Spinner.jsx";
import WorkspaceProfileCard from "../components/workspace/WorkspaceProfileCard.jsx";
import Select from "../components/common/Select.jsx";

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "MEMBER", label: "Member" },
];

export default function WorkspaceSettings() {
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const { refresh } = useWorkspaces();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    workspacesApi.getWorkspace(workspaceId).then((w) => {
      setWorkspace(w);
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

  async function handleProfileSaved() {
    await refresh();
    load();
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
    const ok = await confirm({
      title: "Remove this member?",
      subject: workspace.members.find((m) => m.id === memberId)?.user.name,
      message: "They'll lose access to this workspace right away and need an invite code to rejoin.",
      confirmLabel: "Remove member",
      icon: UserMinus,
    });
    if (!ok) return;
    try {
      await workspacesApi.removeMember(workspaceId, memberId);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleLeave() {
    const ok = await confirm({
      title: "Leave this workspace?",
      subject: workspace.name,
      message: "You'll lose access to its tasks, documents, files and chat, and need an invite code to rejoin.",
      confirmLabel: "Leave workspace",
      icon: LogOut,
    });
    if (!ok) return;
    await workspacesApi.leaveWorkspace(workspaceId);
    await refresh();
    navigate("/");
  }

  return (
    <div className="space-y-6 p-6">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

      <WorkspaceProfileCard key={workspace.id} workspace={workspace} canEdit={isAdmin} onSaved={handleProfileSaved} />

      {/* Members take the wide column; invite and leave stack to their right. */}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="card p-6 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-ink-800 dark:text-ink-100">Members ({workspace.members.length})</h2>
          <div className="space-y-2">
            {workspace.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink-50 dark:hover:bg-ink-700">
                <Avatar name={m.user.name} color={m.user.avatarColor} src={m.user.avatarUrl} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-700 dark:text-ink-200">
                    {m.user.name} {m.user.id === user.id && <span className="text-ink-400">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-ink-400">{m.user.email}</p>
                </div>
                {isAdmin && m.user.id !== user.id ? (
                  <div className="flex items-center gap-2">
                    <Select
                      size="sm"
                      align="end"
                      aria-label={`Role for ${m.user.name}`}
                      value={m.role}
                      onChange={(next) => changeRole(m.id, next)}
                      options={ROLE_OPTIONS}
                    />
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

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="mb-1 text-base font-semibold text-ink-800 dark:text-ink-100">Invite people</h2>
            <p className="mb-3 text-sm text-ink-400">Share this code so others can join.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-dashed border-ink-200 bg-ink-50 px-3 py-2 text-center text-lg font-semibold tracking-widest text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200">
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

          {workspace.ownerId !== user.id && (
            <div className="card border-red-100 p-6">
              <h2 className="mb-1 text-base font-semibold text-ink-800 dark:text-ink-100">Leave workspace</h2>
              <p className="mb-3 text-sm text-ink-400">You'll lose access to its calendar, tasks, and chat.</p>
              <button onClick={handleLeave} className="btn-danger">
                Leave {workspace.name}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

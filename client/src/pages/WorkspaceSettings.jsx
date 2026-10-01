import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { KeyRound, LogOut, UserMinus } from "lucide-react";
import * as workspacesApi from "../api/workspaces.js";
import { apiErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspaces } from "../context/WorkspaceContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useMemberProfile } from "../context/MemberProfileContext.jsx";
import Avatar from "../components/common/Avatar.jsx";
import { RoleBadge } from "../components/common/Badges.jsx";
import Spinner from "../components/common/Spinner.jsx";
import WorkspaceProfileCard from "../components/workspace/WorkspaceProfileCard.jsx";
import MemberAccessModal from "../components/workspace/MemberAccessModal.jsx";
import { can } from "../lib/access.js";

export default function WorkspaceSettings() {
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const { refresh } = useWorkspaces();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const openProfile = useMemberProfile();
  const [copied, setCopied] = useState(false);
  const [accessMemberId, setAccessMemberId] = useState(null);

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
  const accessMember = workspace.members.find((m) => m.id === accessMemberId) || null;

  // Mirrors the server: never yourself or the owner, and an admin can only be
  // removed by another admin, not by someone who was handed members.manage.
  function canRemove(m) {
    if (!can(workspace, "members.manage")) return false;
    if (m.user.id === user.id || m.user.id === workspace.ownerId) return false;
    return m.role !== "ADMIN" || isAdmin;
  }

  async function handleProfileSaved() {
    await refresh();
    load();
  }

  function handleAccessSaved(saved) {
    setWorkspace((w) => ({ ...w, members: w.members.map((m) => (m.id === saved.id ? saved : m)) }));
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
    <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

      <WorkspaceProfileCard
        key={workspace.id}
        workspace={workspace}
        canEdit={can(workspace, "workspace.edit")}
        onSaved={handleProfileSaved}
      />

      {/* Members take the wide column; invite and leave stack to their right. */}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="card p-5 sm:p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-base font-semibold text-ink-800 dark:text-ink-100">Members</h2>
            <span className="chip !py-0.5 tabular-nums">{workspace.members.length}</span>
          </div>
          {isAdmin && (
            <p className="-mt-2 mb-4 text-sm text-ink-400">Open Access to set someone's title, access level and abilities.</p>
          )}
          <div className="space-y-1">
            {workspace.members.map((m) => {
              const isOwner = m.user.id === workspace.ownerId;
              const extra = m.role === "ADMIN" ? 0 : m.permissions?.length || 0;
              return (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-2 py-2 hover:bg-ink-50 dark:hover:bg-ink-700/60"
                >
                  <button
                    type="button"
                    onClick={() => openProfile(m.user.id, workspaceId)}
                    title={`View ${m.user.name}'s profile`}
                    className="group flex min-w-0 flex-1 basis-56 items-center gap-3 text-left"
                  >
                    <Avatar name={m.user.name} color={m.user.avatarColor} src={m.user.avatarUrl} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-ink-700 group-hover:text-brand-600 dark:text-ink-200 dark:group-hover:text-brand-300">
                          {m.user.name}
                        </span>
                        {m.user.id === user.id && <span className="shrink-0 text-sm text-ink-400">(you)</span>}
                        {isOwner && (
                          <span className="shrink-0 rounded-md bg-ink-900/[0.05] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-ink-500 dark:bg-white/[0.07] dark:text-ink-400">
                            Owner
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-ink-400">{m.user.email}</span>
                    </span>
                  </button>

                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <span className="flex flex-col items-end gap-0.5">
                      <RoleBadge role={m.role} title={m.title} />
                      {isAdmin && extra > 0 && (
                        <span className="text-[11px] text-ink-400">
                          +{extra} {extra === 1 ? "ability" : "abilities"}
                        </span>
                      )}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setAccessMemberId(m.id)}
                        aria-label={`Access for ${m.user.name}`}
                        className="btn-secondary !gap-1.5 !rounded-lg !px-2.5 !py-1.5 !text-xs"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Access
                      </button>
                    )}
                    {canRemove(m) && (
                      <button
                        type="button"
                        onClick={() => removeMember(m.id)}
                        aria-label={`Remove ${m.user.name}`}
                        title="Remove from workspace"
                        className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5 sm:p-6">
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
            <div className="card border-red-100 p-5 sm:p-6">
              <h2 className="mb-1 text-base font-semibold text-ink-800 dark:text-ink-100">Leave workspace</h2>
              <p className="mb-3 text-sm text-ink-400">You'll lose access to its calendar, tasks, and chat.</p>
              <button onClick={handleLeave} className="btn-danger">
                Leave {workspace.name}
              </button>
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <MemberAccessModal
          open={!!accessMember}
          onClose={() => setAccessMemberId(null)}
          workspace={workspace}
          member={accessMember}
          currentUserId={user.id}
          onSaved={handleAccessSaved}
        />
      )}
    </div>
  );
}

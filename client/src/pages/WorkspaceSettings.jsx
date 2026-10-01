import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { Check, KeyRound, Link2, LogOut, Mail, UserMinus, UserPlus, X } from "lucide-react";
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
import InviteMembersModal from "../components/workspace/InviteMembersModal.jsx";
import { can } from "../lib/access.js";

// Short enough for the narrow invite column: "Sent just now", "Sent 2 days ago".
function sentLabel(date) {
  if (Date.now() - new Date(date).getTime() < 60 * 1000) return "Sent just now";
  return `Sent ${formatDistanceToNowStrict(new Date(date), { addSuffix: true })}`;
}

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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invites, setInvites] = useState([]);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [inviteFlash, setInviteFlash] = useState(null); // { id, label } shown briefly on one pending row

  const applyInvites = useCallback((data) => {
    setInvites(data.invites);
    setEmailEnabled(data.emailEnabled);
  }, []);

  // Only admins can invite, so only they load the pending list.
  const load = useCallback(() => {
    workspacesApi.getWorkspace(workspaceId).then((w) => {
      setWorkspace(w);
      if (w.myRole === "ADMIN") workspacesApi.listInvites(workspaceId).then(applyInvites).catch(() => {});
    });
  }, [workspaceId, applyInvites]);

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

  function flashInvite(id, label) {
    setInviteFlash({ id, label });
    setTimeout(() => setInviteFlash((f) => (f?.id === id ? null : f)), 1800);
  }

  function copyInviteLink(invite) {
    navigator.clipboard.writeText(invite.link);
    flashInvite(invite.id, "Link copied");
  }

  async function resendInvite(invite) {
    try {
      const data = await workspacesApi.sendInvites(workspaceId, [invite.email]);
      applyInvites(data);
      flashInvite(invite.id, data.results[0]?.emailed ? "Sent again" : "Renewed for 7 days");
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function replaceInviteCode() {
    const ok = await confirm({
      title: "Replace the workspace code?",
      subject: workspace.inviteCode,
      message:
        "The current code stops working right away. Everyone already in stays in, and emailed invites keep working.",
      confirmLabel: "Replace code",
      icon: KeyRound,
    });
    if (!ok) return;
    try {
      const inviteCode = await workspacesApi.resetInviteCode(workspaceId);
      setWorkspace((w) => ({ ...w, inviteCode }));
      setCopied(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function withdrawInvite(invite) {
    try {
      await workspacesApi.revokeInvite(workspaceId, invite.id);
      setInvites((list) => list.filter((i) => i.id !== invite.id));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function removeMember(memberId) {
    const ok = await confirm({
      title: "Remove this member?",
      subject: workspace.members.find((m) => m.id === memberId)?.user.name,
      message: "They'll lose access to this workspace right away and need a new invite to rejoin.",
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
      message: "You'll lose access to its tasks, documents, files and chat, and need a new invite to rejoin.",
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
          {isAdmin ? (
            <div className="card p-5 sm:p-6">
              <h2 className="mb-1 text-base font-semibold text-ink-800 dark:text-ink-100">Invite people</h2>
              <p className="mb-4 text-sm text-ink-400">Email someone an invite, or share the workspace code.</p>
              <button type="button" className="btn-primary w-full" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Invite by email
              </button>

              <p className="section-label mb-2 mt-6">Workspace code</p>
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
              <div className="mt-2 flex items-start justify-between gap-3">
                <p className="text-xs text-ink-400">Anyone with the code can join. Only admins can see it.</p>
                <button
                  type="button"
                  onClick={replaceInviteCode}
                  className="shrink-0 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  New code
                </button>
              </div>

              {invites.length > 0 && (
                <>
                  <div className="mb-1 mt-6 flex items-center gap-2">
                    <p className="section-label">Pending invites</p>
                    <span className="chip !py-0 tabular-nums">{invites.length}</span>
                  </div>
                  <ul className="-mx-2 max-h-80 overflow-y-auto overscroll-contain">
                    {invites.map((invite) => {
                      const flash = inviteFlash?.id === invite.id ? inviteFlash.label : null;
                      return (
                        <li
                          key={invite.id}
                          className="flex items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-ink-50 dark:hover:bg-ink-700/60"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink-700 dark:text-ink-200" title={invite.email}>
                              {invite.email}
                            </p>
                            <p className="truncate text-xs text-ink-400">
                              {flash ? (
                                <span className="text-brand-600 dark:text-brand-400">{flash}</span>
                              ) : invite.expired ? (
                                <span className="text-amber-700 dark:text-amber-300">Expired</span>
                              ) : (
                                sentLabel(invite.sentAt)
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyInviteLink(invite)}
                            aria-label={`Copy invite link for ${invite.email}`}
                            title="Copy invite link"
                            className="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-700 dark:hover:bg-white/[0.08] dark:hover:text-ink-100 sm:p-1.5"
                          >
                            {flash === "Link copied" ? (
                              <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                            ) : (
                              <Link2 className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => resendInvite(invite)}
                            aria-label={`Send the invite to ${invite.email} again`}
                            title={emailEnabled ? "Send again" : "Renew invite"}
                            className="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-700 dark:hover:bg-white/[0.08] dark:hover:text-ink-100 sm:p-1.5"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => withdrawInvite(invite)}
                            aria-label={`Withdraw the invite to ${invite.email}`}
                            title="Withdraw invite"
                            className="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-red-500/10 hover:text-red-500 sm:p-1.5"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          ) : (
            <div className="card p-5 sm:p-6">
              <h2 className="mb-1 text-base font-semibold text-ink-800 dark:text-ink-100">Invite people</h2>
              <p className="text-sm text-ink-400">
                Admins invite new people to {workspace.name}. Ask one of them to send an invite to anyone you'd like to
                add.
              </p>
            </div>
          )}

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
        <InviteMembersModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          workspace={workspace}
          invites={invites}
          emailEnabled={emailEnabled}
          onSent={applyInvites}
        />
      )}

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

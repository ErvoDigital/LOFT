import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import AuthLayout from "../components/common/AuthLayout.jsx";
import Avatar from "../components/common/Avatar.jsx";
import WorkspaceMark from "../components/common/WorkspaceMark.jsx";
import Spinner from "../components/common/Spinner.jsx";
import * as invitesApi from "../api/invites.js";
import { apiErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspaces } from "../context/WorkspaceContext.jsx";

const GONE = "This invite has already been used or was withdrawn.";

// Where the link in an invite email lands. It works signed out, so it can say
// who is inviting them before asking anyone to sign in, and signing in or
// creating an account brings them straight back here. Only the invited
// address can accept (the server checks), so a mismatch is explained here
// rather than left to fail.
export default function AcceptInvite() {
  const { token } = useParams();
  const { user, loading: authLoading, logout } = useAuth();
  const { workspaces, refresh } = useWorkspaces();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    invitesApi
      .getInvite(token)
      .then(setInvite)
      .catch((err) => setLoadError([400, 404].includes(err.response?.status) ? GONE : apiErrorMessage(err)));
  }, [token]);

  const authState = { from: `/invite/${token}`, email: invite?.email };

  async function join() {
    setJoining(true);
    setError("");
    try {
      const workspace = await invitesApi.acceptInvite(token);
      await refresh();
      navigate(`/workspaces/${workspace.id}/dashboard`, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
      setJoining(false);
    }
  }

  function switchAccount() {
    logout();
    navigate("/login", { state: authState });
  }

  if (loadError) {
    return (
      <AuthLayout title="Invite unavailable" subtitle={loadError}>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          Ask the person who invited you to send a new invite, or to share the workspace code.
        </p>
        <Link to="/" className="btn-secondary mt-5 w-full">
          Go to LOFT
        </Link>
      </AuthLayout>
    );
  }

  if (!invite || authLoading) {
    return (
      <div className="auth-backdrop flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const { workspace, invitedBy } = invite;
  const alreadyIn = user && workspaces.some((w) => w.id === workspace.id);
  const isInvitee = user && user.email.toLowerCase() === invite.email;

  let action;
  if (alreadyIn) {
    action = (
      <>
        <p className="text-sm text-ink-500 dark:text-ink-400">You're already a member of this workspace.</p>
        <Link to={`/workspaces/${workspace.id}/dashboard`} className="btn-primary mt-4 w-full">
          Open {workspace.name}
        </Link>
      </>
    );
  } else if (invite.expired) {
    action = (
      <>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          This invite expired on {format(new Date(invite.expiresAt), "MMMM d")}. Ask {invitedBy.name} to send you a new
          one.
        </p>
        <Link to="/" className="btn-secondary mt-4 w-full">
          Go to LOFT
        </Link>
      </>
    );
  } else if (!user) {
    action = (
      <>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          This invite is for <span className="font-medium text-ink-800 dark:text-ink-100">{invite.email}</span>. Sign in
          or create an account with that address to join.
        </p>
        <div className="mt-4 space-y-2">
          <button type="button" className="btn-primary w-full" onClick={() => navigate("/login", { state: authState })}>
            Sign in to join
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => navigate("/register", { state: authState })}
          >
            Create an account
          </button>
        </div>
      </>
    );
  } else if (!isInvitee) {
    action = (
      <>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          This invite is for <span className="font-medium text-ink-800 dark:text-ink-100">{invite.email}</span>, but
          you're signed in as <span className="font-medium text-ink-800 dark:text-ink-100">{user.email}</span>.
        </p>
        <div className="mt-4 space-y-2">
          <button type="button" className="btn-primary w-full" onClick={switchAccount}>
            Sign in with {invite.email}
          </button>
          <Link to="/" className="btn-ghost w-full">
            Stay signed in as {user.name}
          </Link>
        </div>
      </>
    );
  } else {
    action = (
      <>
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}
        <button type="button" className="btn-primary w-full" disabled={joining} onClick={join}>
          {joining ? "Joining…" : `Join ${workspace.name}`}
        </button>
      </>
    );
  }

  return (
    <AuthLayout title="You're invited" subtitle={`${invitedBy.name} invited you to a workspace on LOFT`}>
      <div className="flex items-center gap-3">
        <WorkspaceMark
          name={workspace.name}
          color={workspace.color}
          logoUrl={workspace.logoUrl}
          className="h-12 w-12 rounded-xl text-base"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-ink-900 dark:text-ink-50">{workspace.name}</h2>
          <p className="text-xs text-ink-400">
            {workspace.memberCount} {workspace.memberCount === 1 ? "member" : "members"}
          </p>
        </div>
      </div>
      {workspace.description && (
        <p className="mt-3 line-clamp-3 text-sm text-ink-500 dark:text-ink-400">{workspace.description}</p>
      )}
      <div className="mt-4 flex items-center gap-2 border-t border-ink-900/[0.07] pt-4 text-xs text-ink-400 dark:border-white/[0.06]">
        <Avatar name={invitedBy.name} color={invitedBy.avatarColor} src={invitedBy.avatarUrl} size={20} />
        <span className="min-w-0 truncate">Invited by {invitedBy.name}</span>
      </div>
      <div className="mt-5">{action}</div>
    </AuthLayout>
  );
}

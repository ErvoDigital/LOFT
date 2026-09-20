import { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import Modal from "../common/Modal.jsx";
import Avatar from "../common/Avatar.jsx";
import WorkspaceMark from "../common/WorkspaceMark.jsx";
import Spinner from "../common/Spinner.jsx";
import * as usersApi from "../../api/users.js";
import * as messagesApi from "../../api/messages.js";
import * as workspacesApi from "../../api/workspaces.js";
import { apiErrorMessage } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";

function PersonRow({ person, subtitle, onClick, disabled }) {
  return (
    <button
      key={person.id}
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-ink-900/[0.04] disabled:opacity-60 dark:hover:bg-white/[0.06]"
    >
      <Avatar name={person.name} color={person.avatarColor} src={person.avatarUrl} size={30} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink-700 dark:text-ink-200">{person.name}</p>
        <p className="truncate text-xs text-ink-400">{subtitle ?? person.email}</p>
      </div>
    </button>
  );
}

function SectionLabel({ children }) {
  return <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{children}</p>;
}

// Starting a conversation, from whichever direction you know the person:
// someone you follow, someone in one of your workspaces, or a name you type.
// Picking a workspace opens its member list in place — the dialog stays one
// screen deep, so there's never more than one step to undo.
export default function NewDmModal({ open, onClose, onStarted }) {
  const { user: me } = useAuth();
  const { workspaces } = useWorkspaces();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [following, setFollowing] = useState([]);
  const [openWorkspace, setOpenWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setOpenWorkspace(null);
    setMembers([]);
    setError("");
    usersApi
      .listMyFollows()
      .then((data) => setFollowing(data.following))
      .catch(() => setFollowing([]));
  }, [open]);

  async function handleSearch(q) {
    setQuery(q);
    if (q.trim().length < 2) return setResults([]);
    setSearching(true);
    try {
      setResults(await usersApi.searchUsers(q));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  async function pickWorkspace(workspace) {
    setOpenWorkspace(workspace);
    setLoadingMembers(true);
    setError("");
    try {
      const full = await workspacesApi.getWorkspace(workspace.id);
      setMembers(full.members.map((m) => m.user).filter((u) => u.id !== me?.id));
    } catch (err) {
      setError(apiErrorMessage(err));
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function selectUser(userId) {
    setStarting(true);
    setError("");
    try {
      const conversationId = await messagesApi.startDirectMessage(userId);
      onStarted(conversationId);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  const hasQuery = query.trim().length >= 2;

  return (
    <Modal open={open} onClose={onClose} title={openWorkspace ? openWorkspace.name : "New message"}>
      {openWorkspace ? (
        <>
          <button onClick={() => setOpenWorkspace(null)} className="btn-ghost !px-2 !py-1 text-xs">
            All workspaces
          </button>
          <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
            {loadingMembers ? (
              <Spinner className="py-8" />
            ) : members.length === 0 ? (
              <p className="px-2 py-3 text-sm text-ink-400">No one else is in this workspace yet.</p>
            ) : (
              members.map((person) => (
                <PersonRow key={person.id} person={person} onClick={() => selectUser(person.id)} disabled={starting} />
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className="input !pl-9"
              placeholder="Search people by name or email…"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-80 overflow-y-auto">
            {hasQuery ? (
              <>
                {searching && <p className="px-2 py-2 text-sm text-ink-400">Searching…</p>}
                {!searching && results.length === 0 && <p className="px-2 py-2 text-sm text-ink-400">No one found.</p>}
                {results.map((person) => (
                  <PersonRow key={person.id} person={person} onClick={() => selectUser(person.id)} disabled={starting} />
                ))}
              </>
            ) : (
              <>
                {following.length > 0 && (
                  <>
                    <SectionLabel>People you follow</SectionLabel>
                    {following.map((person) => (
                      <PersonRow key={person.id} person={person} onClick={() => selectUser(person.id)} disabled={starting} />
                    ))}
                  </>
                )}

                <SectionLabel>Your workspaces</SectionLabel>
                {workspaces.length === 0 ? (
                  <p className="px-2 py-2 text-sm text-ink-400">You haven't joined a workspace yet.</p>
                ) : (
                  workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={() => pickWorkspace(workspace)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-ink-900/[0.04] dark:hover:bg-white/[0.06]"
                    >
                      <WorkspaceMark
                        name={workspace.name}
                        color={workspace.color}
                        logoUrl={workspace.logoUrl}
                        className="h-[30px] w-[30px] rounded-lg text-[11px]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-700 dark:text-ink-200">{workspace.name}</p>
                        <p className="truncate text-xs text-ink-400">
                          {workspace.memberCount} {workspace.memberCount === 1 ? "member" : "members"}
                        </p>
                      </div>
                      <Users className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                    </button>
                  ))
                )}

                {following.length === 0 && (
                  <p className="px-2 pb-1 pt-3 text-xs leading-relaxed text-ink-400">
                    Follow someone from their profile and they'll show up here.
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>
      )}
    </Modal>
  );
}

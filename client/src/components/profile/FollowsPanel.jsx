import { useCallback, useEffect, useState } from "react";
import { UserCheck, UserPlus, UserX } from "lucide-react";
import * as usersApi from "../../api/users.js";
import { apiErrorMessage } from "../../api/client.js";
import { useSocket } from "../../context/SocketContext.jsx";
import { useMemberProfile } from "../../context/MemberProfileContext.jsx";
import Avatar from "../common/Avatar.jsx";
import Spinner from "../common/Spinner.jsx";

function Person({ person, children }) {
  const openProfile = useMemberProfile();
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <button
        onClick={() => openProfile(person.id)}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-ink-900/[0.04] dark:hover:bg-white/[0.06]"
      >
        <Avatar name={person.name} color={person.avatarColor} src={person.avatarUrl} size={32} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink-800 dark:text-ink-100">{person.name}</span>
          <span className="block truncate text-xs text-ink-400">{person.email}</span>
        </span>
      </button>
      <span className="flex shrink-0 items-center gap-1.5">{children}</span>
    </li>
  );
}

// Where follow requests are answered — the follow-request notification links
// here. Requests come first because they're the only part that needs a
// decision; the accepted list below is what fills the new-message dialog.
export default function FollowsPanel() {
  const { socket } = useSocket();
  const [follows, setFollows] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    usersApi
      .listMyFollows()
      .then(setFollows)
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  useEffect(() => load(), [load]);

  // Someone accepting or requesting while this page is open.
  useEffect(() => {
    if (!socket) return;
    socket.on("follow:updated", load);
    return () => socket.off("follow:updated", load);
  }, [socket, load]);

  // The profile card is mounted app-wide rather than under this panel, so a
  // follow changed from there announces itself instead of calling back down.
  useEffect(() => {
    window.addEventListener("loft:follow-changed", load);
    return () => window.removeEventListener("loft:follow-changed", load);
  }, [load]);

  async function act(userId, action) {
    setBusyId(userId);
    setError("");
    try {
      await action(userId);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-base font-semibold text-ink-800 dark:text-ink-100">People</h2>
      <p className="mb-4 text-xs text-ink-400">
        Following is mutual. Whoever you follow shows up when you start a new message.
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>
      )}

      {!follows ? (
        <Spinner className="py-6" />
      ) : (
        <div className="space-y-5">
          {follows.incoming.length > 0 && (
            <section>
              <h3 className="section-label mb-1">Follow requests</h3>
              <ul>
                {follows.incoming.map((person) => (
                  <Person key={person.id} person={person}>
                    <button
                      onClick={() => act(person.id, usersApi.acceptFollow)}
                      disabled={busyId === person.id}
                      className="btn-primary !px-2.5 !py-1 text-xs"
                    >
                      <UserCheck className="h-3.5 w-3.5" /> Accept
                    </button>
                    <button
                      onClick={() => act(person.id, usersApi.removeFollow)}
                      disabled={busyId === person.id}
                      className="btn-secondary !px-2.5 !py-1 text-xs"
                    >
                      Decline
                    </button>
                  </Person>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="section-label mb-1">Following ({follows.following.length})</h3>
            {follows.following.length === 0 ? (
              <p className="flex items-center gap-2 py-2 text-sm text-ink-400">
                <UserPlus className="h-4 w-4" /> No one yet — open someone's profile and follow them.
              </p>
            ) : (
              <ul>
                {follows.following.map((person) => (
                  <Person key={person.id} person={person}>
                    <button
                      onClick={() => act(person.id, usersApi.removeFollow)}
                      disabled={busyId === person.id}
                      title="Unfollow"
                      className="btn-ghost !px-2.5 !py-1 text-xs"
                    >
                      <UserX className="h-3.5 w-3.5" /> Unfollow
                    </button>
                  </Person>
                ))}
              </ul>
            )}
          </section>

          {follows.outgoing.length > 0 && (
            <section>
              <h3 className="section-label mb-1">Requested ({follows.outgoing.length})</h3>
              <ul>
                {follows.outgoing.map((person) => (
                  <Person key={person.id} person={person}>
                    <button
                      onClick={() => act(person.id, usersApi.removeFollow)}
                      disabled={busyId === person.id}
                      className="btn-ghost !px-2.5 !py-1 text-xs"
                    >
                      Cancel
                    </button>
                  </Person>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

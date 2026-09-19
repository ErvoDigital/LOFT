import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, MessageSquare, UserPen } from "lucide-react";
import * as usersApi from "../../api/users.js";
import * as messagesApi from "../../api/messages.js";
import { apiErrorMessage } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { usePresence } from "../../context/PresenceContext.jsx";
import Modal from "../common/Modal.jsx";
import Avatar from "../common/Avatar.jsx";
import Spinner from "../common/Spinner.jsx";
import WorkspaceMark from "../common/WorkspaceMark.jsx";
import { RoleBadge, TierBadge } from "../common/Badges.jsx";

const ROLE_LABELS = { ADMIN: "Admin", MANAGER: "Manager", MEMBER: "Member" };

function dayDiff(date) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  return Math.round((due - start) / 86_400_000);
}

function dueLabel(dueDate) {
  if (!dueDate) return { text: "No due date", tone: "text-ink-400" };
  const diff = dayDiff(dueDate);
  const date = new Date(dueDate).toLocaleDateString([], { month: "short", day: "numeric" });
  if (diff < 0) return { text: `Overdue · ${date}`, tone: "text-red-500 dark:text-red-400" };
  if (diff === 0) return { text: "Due today", tone: "text-accent-600 dark:text-accent-400" };
  if (diff === 1) return { text: "Due tomorrow", tone: "text-ink-500 dark:text-ink-400" };
  return { text: `Due ${date}`, tone: "text-ink-500 dark:text-ink-400" };
}

function monthYear(date) {
  return new Date(date).toLocaleDateString([], { month: "long", year: "numeric" });
}

function Stat({ value, label, tone = "text-ink-900 dark:text-ink-50" }) {
  return (
    <div className="rounded-xl border border-ink-200/70 bg-white/60 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
      <p className={`text-xl font-semibold tabular-nums tracking-tight ${tone}`}>{value}</p>
      <p className="text-[11px] font-medium text-ink-500 dark:text-ink-400">{label}</p>
    </div>
  );
}

// A teammate's profile card, opened from anywhere a member's avatar or name
// appears (see MemberProfileContext). `workspaceId` is the workspace it was
// opened from: it decides which role is shown up top and narrows the task
// figures to that workspace's board.
export default function MemberProfileModal({ open, onClose, userId, workspaceId }) {
  const { user: me } = useAuth();
  const { supported, isOnline } = usePresence();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setProfile(null);
    setError("");
    usersApi
      .getUserProfile(userId, workspaceId)
      .then((data) => !cancelled && setProfile(data))
      .catch((err) => !cancelled && setError(apiErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [open, userId, workspaceId]);

  const isMe = userId === me?.id;
  const online = supported && isOnline(userId);
  const shared = profile?.sharedWorkspaces || [];
  const focus = shared.find((w) => w.id === workspaceId);
  const tasks = profile?.tasks;

  async function startMessage() {
    setStarting(true);
    try {
      const conversationId = await messagesApi.startDirectMessage(userId);
      onClose();
      navigate("/chat", { state: { conversationId } });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  function openBoard(targetWorkspaceId) {
    onClose();
    navigate(`/workspaces/${targetWorkspaceId}/tasks`);
  }

  return (
    <Modal open={open} onClose={onClose} title="Profile">
      {error && !profile ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>
      ) : !profile ? (
        <Spinner className="py-12" />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <span className="relative shrink-0">
              <Avatar name={profile.user.name} color={profile.user.avatarColor} src={profile.user.avatarUrl} size={64} />
              {supported && (
                <span
                  className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full ring-[3px] ring-white dark:ring-ink-900 ${
                    online ? "bg-emerald-500" : "bg-ink-300 dark:bg-ink-600"
                  }`}
                />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold tracking-tight text-ink-900 dark:text-ink-50">
                {profile.user.name}
                {isMe && <span className="font-normal text-ink-400"> (you)</span>}
              </p>
              <a
                href={`mailto:${profile.user.email}`}
                className="flex min-w-0 items-center gap-1.5 text-sm text-ink-500 hover:text-brand-600 dark:text-ink-400 dark:hover:text-brand-300"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{profile.user.email}</span>
              </a>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
                {supported && <span className={online ? "font-medium text-emerald-600 dark:text-emerald-400" : ""}>{online ? "Online" : "Offline"}</span>}
                {supported && focus && <span aria-hidden="true">·</span>}
                {focus && (
                  <span>
                    {ROLE_LABELS[focus.role] || focus.role} in {focus.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {isMe ? (
              <button
                onClick={() => {
                  onClose();
                  navigate("/profile");
                }}
                className="btn-secondary flex-1"
              >
                <UserPen className="h-4 w-4" /> Edit your profile
              </button>
            ) : (
              <button onClick={startMessage} disabled={starting} className="btn-primary flex-1">
                <MessageSquare className="h-4 w-4" /> {starting ? "Opening…" : "Message"}
              </button>
            )}
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

          {shared.length > 0 && tasks && (
            <section>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="section-label">Tasks</h3>
                <span className="truncate text-[11px] text-ink-400">{focus ? focus.name : "Across shared workspaces"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat value={tasks.open} label="Open" />
                <Stat value={tasks.overdue} label="Overdue" tone={tasks.overdue ? "text-red-500 dark:text-red-400" : undefined} />
                <Stat value={tasks.done} label="Done" />
              </div>

              {tasks.upcoming.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {tasks.upcoming.map((t) => {
                    const due = dueLabel(t.dueDate);
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => openBoard(t.workspaceId)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-ink-900/[0.04] dark:hover:bg-white/[0.06]"
                        >
                          {/* Fixed column: Tier 1's pulse dot makes its badge wider. */}
                          <span className="flex w-14 shrink-0">
                            <TierBadge tier={t.tier} compact />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink-700 dark:text-ink-200">{t.title}</span>
                            <span className={`block truncate text-[11px] ${due.tone}`}>
                              {due.text}
                              {!focus && t.workspaceName && <span className="text-ink-400"> · {t.workspaceName}</span>}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {tasks.open === 0 && <p className="mt-2 text-xs text-ink-400">Nothing open on {isMe ? "your" : "their"} plate right now.</p>}
            </section>
          )}

          {shared.length > 0 && (
            <section>
              <h3 className="section-label mb-2">{isMe ? "Your workspaces" : "Shared workspaces"}</h3>
              <ul className="space-y-1.5">
                {shared.map((w) => (
                  <li key={w.id} className="flex items-center gap-2.5">
                    <WorkspaceMark name={w.name} color={w.color} logoUrl={w.logoUrl} className="h-7 w-7 rounded-lg text-[11px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-700 dark:text-ink-200">{w.name}</span>
                      <span className="block text-[11px] text-ink-400">Since {monthYear(w.joinedAt)}</span>
                    </span>
                    <RoleBadge role={w.role} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="border-t border-ink-200/70 pt-3 text-[11px] text-ink-400 dark:border-white/[0.08]">
            On LOFT since {monthYear(profile.user.createdAt)}
          </p>
        </div>
      )}
    </Modal>
  );
}

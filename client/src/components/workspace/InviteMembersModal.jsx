import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Info, Mail, UserPlus, X } from "lucide-react";
import Modal from "../common/Modal.jsx";
import Avatar from "../common/Avatar.jsx";
import * as usersApi from "../../api/users.js";
import * as workspacesApi from "../../api/workspaces.js";
import { apiErrorMessage } from "../../api/client.js";

// Mirrors the server's per-send cap (MAX_INVITES_PER_SEND).
const MAX_RECIPIENTS = 20;
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;
const SEPARATORS = /[\s,;]+/;

const isEmail = (value) => EMAIL_RE.test(value);

function Outcome({ result }) {
  if (result.status === "member") return <span className="text-ink-400">Already in the workspace</span>;
  if (result.emailed) {
    return (
      <span className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400">
        <Check className="h-3.5 w-3.5" />
        Email sent
      </span>
    );
  }
  if (result.notified) return <span className="text-ink-500 dark:text-ink-300">Not emailed, but notified in LOFT</span>;
  return <span className="text-amber-700 dark:text-amber-300">Not emailed. Copy their link from Pending invites</span>;
}

// Settings → Invite people. Type or paste any email address, or search for
// someone who already has a LOFT account; each one becomes a chip. Sending
// emails everyone a link that joins them to the workspace, and the dialog
// then reports what happened to each address before closing.
export default function InviteMembersModal({ open, onClose, workspace, invites, emailEnabled, onSent }) {
  const [recipients, setRecipients] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const inputRef = useRef(null);
  const searchSeq = useRef(0);

  const memberEmails = useMemo(
    () => new Set((workspace?.members || []).map((m) => m.user.email.toLowerCase())),
    [workspace]
  );
  const pendingEmails = useMemo(() => new Set((invites || []).map((i) => i.email)), [invites]);
  const chosen = useMemo(() => new Set(recipients.map((r) => r.email)), [recipients]);

  useEffect(() => {
    if (!open) return;
    setRecipients([]);
    setQuery("");
    setResults([]);
    setNotice("");
    setError("");
    setOutcome(null);
  }, [open]);

  // Searches LOFT accounts as the admin types, ignoring replies that arrive
  // after a newer keystroke has already started its own search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || SEPARATORS.test(q)) {
      setResults([]);
      setSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(() => {
      usersApi
        .searchUsers(q)
        .then((users) => seq === searchSeq.current && setResults(users))
        .catch(() => seq === searchSeq.current && setResults([]))
        .finally(() => seq === searchSeq.current && setSearching(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Adds people to the list, explaining anyone who can't be added. Returns
  // the list as it stands afterwards, for a send that commits typed text.
  function addRecipients(people) {
    const next = [...recipients];
    const problems = [];
    for (const person of people) {
      const email = person.email.trim().toLowerCase();
      if (!isEmail(email)) problems.push(`"${person.email}" isn't an email address.`);
      else if (memberEmails.has(email)) problems.push(`${email} is already in ${workspace.name}.`);
      else if (next.some((r) => r.email === email)) continue;
      else if (next.length >= MAX_RECIPIENTS) {
        problems.push(`You can invite up to ${MAX_RECIPIENTS} people at a time.`);
        break;
      } else next.push({ ...person, email });
    }
    setRecipients(next);
    setNotice(problems[0] || "");
    return next;
  }

  function commitTyped() {
    const parts = query.split(SEPARATORS).filter(Boolean);
    if (parts.length === 0) return recipients;
    // A name rather than an address: Enter picks the top search result.
    if (parts.length === 1 && !isEmail(parts[0]) && results.length > 0) {
      const pick = results.find((u) => !memberEmails.has(u.email.toLowerCase())) || results[0];
      setQuery("");
      return addRecipients([pick]);
    }
    setQuery("");
    return addRecipients(parts.map((email) => ({ email })));
  }

  function pick(person) {
    addRecipients([person]);
    setQuery("");
    inputRef.current?.focus();
  }

  function remove(email) {
    setRecipients((list) => list.filter((r) => r.email !== email));
    setNotice("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      commitTyped();
    } else if (e.key === "Backspace" && query === "" && recipients.length > 0) {
      remove(recipients[recipients.length - 1].email);
    }
  }

  // A pasted list ("a@x.com, b@y.com" or one per line) becomes chips at once.
  function handlePaste(e) {
    const text = e.clipboardData.getData("text");
    const parts = text.split(SEPARATORS).filter(Boolean);
    if (parts.length < 2) return;
    e.preventDefault();
    addRecipients(parts.map((email) => ({ email })));
  }

  async function send() {
    const list = commitTyped();
    if (list.length === 0) return;
    setSending(true);
    setError("");
    try {
      const response = await workspacesApi.sendInvites(
        workspace.id,
        list.map((r) => r.email)
      );
      onSent(response);
      setOutcome(response.results);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const typed = query.trim().toLowerCase();
  const typedIsNew = isEmail(typed) && !results.some((u) => u.email.toLowerCase() === typed);
  const showSuggestions = typed.length >= 2 && !SEPARATORS.test(typed);

  if (outcome) {
    const emailed = outcome.filter((r) => r.emailed).length;
    const invited = outcome.filter((r) => r.status === "invited").length;
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={
          emailed === invited && invited > 0
            ? `Sent ${emailed} ${emailed === 1 ? "invite" : "invites"}`
            : "Invites saved"
        }
        width="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary max-sm:flex-1"
              onClick={() => {
                setOutcome(null);
                setRecipients([]);
              }}
            >
              Invite more
            </button>
            <button type="button" className="btn-primary max-sm:flex-1" onClick={onClose}>
              Done
            </button>
          </div>
        }
      >
        <p className="text-sm text-ink-500 dark:text-ink-400">
          {invited > 0
            ? "Each invite works for 7 days, and only for the address it was sent to."
            : "Everyone on the list is already in the workspace."}
        </p>
        <ul className="mt-4 divide-y divide-ink-900/[0.06] dark:divide-white/[0.06]">
          {outcome.map((result) => (
            <li
              key={result.email}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2.5 text-sm"
            >
              <span className="min-w-0 truncate font-medium text-ink-700 dark:text-ink-200">{result.email}</span>
              <span className="text-xs">
                <Outcome result={result} />
              </span>
            </li>
          ))}
        </ul>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite people"
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="hidden text-sm text-ink-500 dark:text-ink-400 sm:block">
            <span className="font-semibold tabular-nums text-ink-900 dark:text-ink-50">{recipients.length}</span>{" "}
            {recipients.length === 1 ? "person" : "people"}
          </p>
          <div className="flex flex-1 justify-end gap-2 sm:flex-none">
            <button type="button" className="btn-ghost max-sm:flex-1" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary max-sm:flex-1"
              disabled={sending || (recipients.length === 0 && !isEmail(typed))}
              onClick={send}
            >
              <Mail className="h-4 w-4" />
              {sending ? "Sending…" : "Send invites"}
            </button>
          </div>
        </div>
      }
    >
      <p className="text-sm text-ink-500 dark:text-ink-400">
        Search for someone on LOFT or enter any email address. Each person gets an email with a link to join{" "}
        <span className="font-medium text-ink-700 dark:text-ink-200">{workspace.name}</span>.
      </p>

      {!emailEnabled && (
        <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <Info className="mt-px h-4 w-4 shrink-0" />
          Email isn't set up on the server yet, so nothing goes out by email. People who already use LOFT get a
          notification, and you can copy anyone's invite link from Pending invites.
        </p>
      )}

      <div
        onClick={() => inputRef.current?.focus()}
        className="input mt-4 flex min-h-[46px] cursor-text flex-wrap items-center gap-1.5 !py-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25 dark:focus-within:border-brand-500/60"
      >
        {recipients.map((r) => (
          <span
            key={r.email}
            title={r.email}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-brand-500/10 py-1 pl-1.5 pr-1 text-xs font-medium text-brand-800 dark:bg-brand-400/15 dark:text-brand-200"
          >
            {r.name ? (
              <Avatar name={r.name} color={r.avatarColor} src={r.avatarUrl} size={18} />
            ) : (
              <Mail className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{r.name || r.email}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(r.email);
              }}
              aria-label={`Remove ${r.email}`}
              className="rounded p-0.5 opacity-70 hover:bg-brand-500/15 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          inputMode="email"
          autoComplete="off"
          autoFocus
          aria-label="Email addresses"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setNotice("");
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => isEmail(typed) && commitTyped()}
          placeholder={recipients.length ? "Add another…" : "Name or email, e.g. sam@school.edu"}
          className="min-w-[10rem] flex-1 bg-transparent py-1 text-sm text-ink-900 outline-none placeholder:text-ink-500 dark:text-ink-100"
        />
      </div>
      <p className="mt-1.5 text-xs text-ink-400">
        Press Enter or a comma after each address. You can paste a list too.
      </p>

      {notice && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{notice}</p>}

      {showSuggestions && (
        <div className="mt-3 max-h-64 space-y-0.5 overflow-y-auto overscroll-contain">
          {typedIsNew && (
            <button
              type="button"
              disabled={memberEmails.has(typed)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick({ email: typed })}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-ink-900/[0.04] disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent dark:hover:bg-white/[0.06]"
            >
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 dark:bg-brand-400/15 dark:text-brand-300">
                <UserPlus className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink-700 dark:text-ink-200">
                  Invite {typed}
                </span>
                <span className="block text-xs text-ink-400">
                  {memberEmails.has(typed) ? "Already in the workspace" : "They'll get an email with a link to join"}
                </span>
              </span>
            </button>
          )}
          {results.map((person) => {
            const email = person.email.toLowerCase();
            const isMember = memberEmails.has(email);
            const added = chosen.has(email);
            return (
              <button
                key={person.id}
                type="button"
                disabled={isMember}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (added ? remove(email) : pick(person))}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-ink-900/[0.04] disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent dark:hover:bg-white/[0.06]"
              >
                <Avatar name={person.name} color={person.avatarColor} src={person.avatarUrl} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-700 dark:text-ink-200">
                    {person.name}
                  </span>
                  <span className="block truncate text-xs text-ink-400">{person.email}</span>
                </span>
                {isMember ? (
                  <span className="shrink-0 text-xs text-ink-400">Member</span>
                ) : added ? (
                  <Check className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-label="Added" />
                ) : pendingEmails.has(email) ? (
                  <span className="chip shrink-0 !py-0.5">Invited</span>
                ) : null}
              </button>
            );
          })}
          {!searching && !typedIsNew && results.length === 0 && (
            <p className="px-2 py-2 text-sm text-ink-400">
              No one on LOFT matches. Type their full email address to invite them.
            </p>
          )}
          {searching && results.length === 0 && <p className="px-2 py-2 text-sm text-ink-400">Searching…</p>}
        </div>
      )}

      {recipients.some((r) => pendingEmails.has(r.email)) && (
        <p className="mt-3 text-xs text-ink-400">
          Anyone already invited gets a fresh email, and their invite is renewed.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}
    </Modal>
  );
}

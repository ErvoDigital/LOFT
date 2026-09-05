import { useState } from "react";
import Modal from "../common/Modal.jsx";
import Avatar from "../common/Avatar.jsx";
import * as usersApi from "../../api/users.js";
import * as messagesApi from "../../api/messages.js";

export default function NewDmModal({ open, onClose, onStarted }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(q) {
    setQuery(q);
    if (q.trim().length < 2) return setResults([]);
    setLoading(true);
    const users = await usersApi.searchUsers(q);
    setResults(users);
    setLoading(false);
  }

  async function selectUser(userId) {
    const conversationId = await messagesApi.startDirectMessage(userId);
    setQuery("");
    setResults([]);
    onStarted(conversationId);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New message">
      <input
        className="input"
        placeholder="Search people by name or email…"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        autoFocus
      />
      <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
        {loading && <p className="px-2 py-2 text-sm text-ink-400">Searching…</p>}
        {!loading && query.length >= 2 && results.length === 0 && (
          <p className="px-2 py-2 text-sm text-ink-400">No one found.</p>
        )}
        {results.map((u) => (
          <button
            key={u.id}
            onClick={() => selectUser(u.id)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-ink-50"
          >
            <Avatar name={u.name} color={u.avatarColor} src={u.avatarUrl} size={30} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-700">{u.name}</p>
              <p className="truncate text-xs text-ink-400">{u.email}</p>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

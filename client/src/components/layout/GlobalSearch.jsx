import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import Modal from "../common/Modal.jsx";
import { globalSearch } from "../../api/search.js";
import { apiErrorMessage } from "../../api/client.js";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";
import { useMemberProfile } from "../../context/MemberProfileContext.jsx";

const CATEGORIES = { tasks: "Tasks", events: "Events", documents: "Documents", messages: "Messages", assets: "Files", users: "People" };
export function searchResultPath(type, item) {
  const base = `/workspaces/${item.workspaceId}`;
  if (type === "tasks") return `${base}/tasks?task=${item.id}`;
  if (type === "events") return `${base}/calendar?event=${item.id}`;
  if (type === "documents") return `${base}/docs/${item.id}`;
  if (type === "assets") return `${base}/storage?asset=${item.id}${item.folderId ? `&folder=${item.folderId}` : ""}`;
  if (type === "messages") return `${item.workspaceId ? `${base}/chat` : "/chat"}?conversation=${item.conversationId}&message=${item.id}`;
}
export default function GlobalSearch() {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [type, setType] = useState("all"), [workspace, setWorkspace] = useState("");
  const [results, setResults] = useState({}), [loading, setLoading] = useState(false), [error, setError] = useState(""), [active, setActive] = useState(0);
  const input = useRef(null);
  const navigate = useNavigate(), openProfile = useMemberProfile();
  const { workspaces } = useWorkspaces();
  const close = () => setOpen(false);
  useEffect(() => {
    const onKey = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !event.altKey) { event.preventDefault(); setOpen((value) => !value); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) { const timer = setTimeout(() => input.current?.focus(), 0); return () => clearTimeout(timer); } }, [open]);
  useEffect(() => {
    setResults({}); setError(""); setActive(0);
    if (!open || !query.trim()) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true);
    const timer = setTimeout(() => {
      globalSearch(query.trim(), workspace, controller.signal).then((data) => { if (!controller.signal.aborted) setResults(data); }).catch((err) => { if (!controller.signal.aborted) setError(apiErrorMessage(err)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, query, workspace]);
  const entries = Object.entries(CATEGORIES).filter(([category]) => type === "all" || category === type).flatMap(([category]) => (results[category] || []).map((item) => ({ category, item })));
  function choose({ category, item }) { close(); if (category === "users") openProfile(item.id); else navigate(searchResultPath(category, item)); }
  return <>
    <button type="button" aria-label="Search everything (Ctrl+K)" onClick={() => setOpen(true)} className="flex h-10 items-center gap-2 rounded-xl px-2 text-ink-500 hover:bg-brand-500/10 sm:px-3 lg:h-8"><Search className="h-4 w-4" /><span className="hidden text-sm sm:inline">Search</span><kbd className="hidden text-[10px] lg:inline">Ctrl K</kbd></button>
    <Modal open={open} onClose={close} title="Search everything" width="max-w-2xl">
      <input ref={input} className="input" placeholder="Find tasks, events, documents, messages, files or people…" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search all workspaces" aria-controls="global-search-results" onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, Math.min(entries.length - 1, value + (event.key === "ArrowDown" ? 1 : -1)))); }
        if (event.key === "Enter" && entries[active]) { event.preventDefault(); choose(entries[active]); }
      }} />
      <div className="my-3 flex flex-wrap gap-2"><select className="input !w-auto" aria-label="Search category" value={type} onChange={(event) => { setType(event.target.value); setActive(0); }}><option value="all">Everything</option>{Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select className="input !w-auto" aria-label="Search workspace" value={workspace} onChange={(event) => setWorkspace(event.target.value)}><option value="">All workspaces and DMs</option>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <p role="status" className="text-xs text-ink-500">{loading ? "Searching…" : !query.trim() ? "Type to search across your workspaces." : `${entries.length} results. Use ↑ ↓ and Enter to open.`}</p>
      <div id="global-search-results" className="mt-3 max-h-96 overflow-y-auto">{entries.map(({ category, item }, index) => <button type="button" key={`${category}:${item.id}`} aria-current={index === active ? "true" : undefined} onFocus={() => setActive(index)} onClick={() => choose({ category, item })} className={`block w-full rounded-xl p-3 text-left ${index === active ? "bg-brand-500/10" : "hover:bg-ink-500/5"}`}>
        <span className="text-[11px] text-ink-400">{CATEGORIES[category]} · {item.workspaceName || item.conversationTitle || (category === "messages" ? "Direct message" : "Shared teammate")}</span>
        <span className="block truncate text-sm font-medium">{item.title || item.name || item.content || "Attachment"}</span>
        {(item.description || item.email) && <span className="block truncate text-xs text-ink-500">{item.description || item.email}</span>}
      </button>)}</div>
    </Modal>
  </>;
}

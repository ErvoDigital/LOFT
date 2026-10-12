import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { FileText, Lock, Plus, Search, Settings, Trash2 } from "lucide-react";
import * as documentsApi from "../api/documents.js";
import * as workspacesApi from "../api/workspaces.js";
import { apiErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import Avatar from "../components/common/Avatar.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Spinner from "../components/common/Spinner.jsx";
import DocumentAccessModal from "../components/documents/DocumentAccessModal.jsx";
import { can } from "../lib/access.js";

const DOCUMENT_EVENTS = ["document:created", "document:renamed", "document:updated", "document:deleted"];

export default function WorkspaceDocuments() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [documents, setDocuments] = useState([]);
  const [access, setAccess] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const [accessDoc, setAccessDoc] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated");
  const [filter, setFilter] = useState("all");
  const visibleDocuments = useMemo(() => documents.filter((doc) => {
    return (filter !== "mine" || doc.createdBy.id === user.id) && `${doc.title} ${doc.createdBy.name}`.toLowerCase().includes(query.trim().toLowerCase());
  }).sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : new Date(b[sort === "created" ? "createdAt" : "updatedAt"]) - new Date(a[sort === "created" ? "createdAt" : "updatedAt"])), [documents, filter, query, sort, user.id]);

  const load = useCallback(() => {
    Promise.all([documentsApi.listDocuments(workspaceId), workspacesApi.getWorkspace(workspaceId)])
      .then(([docs, ws]) => {
        setDocuments(docs);
        setError("");
        setAccess(ws);
        setMembers(ws.members);
        setLoading(false);
      })
      .catch((err) => {
        setError(apiErrorMessage(err));
        setLoading(false);
      });
  }, [workspaceId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => load();
    DOCUMENT_EVENTS.forEach((e) => socket.on(e, handler));
    return () => DOCUMENT_EVENTS.forEach((e) => socket.off(e, handler));
  }, [socket, load]);

  async function createDocument() {
    if (creating) return;
    setCreating(true);
    try {
      const doc = await documentsApi.createDocument(workspaceId);
      navigate(`/workspaces/${workspaceId}/docs/${doc.id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
      setCreating(false);
    }
  }

  async function deleteDocument(e, docId) {
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete this document?",
      subject: documents.find((d) => d.id === docId)?.title,
      message: "It will be deleted for everyone in this workspace. This can't be undone.",
      confirmLabel: "Delete document",
    });
    if (!ok) return;
    try {
      await documentsApi.deleteDocument(workspaceId, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-ink-800 dark:text-ink-100">Documents <span className="ml-1.5 text-sm font-normal text-ink-400">{documents.length}</span></h1>
          <p className="text-sm text-ink-400">Write, organize, and collaborate on your workspace documents.</p>
        </div>
        <button onClick={createDocument} disabled={creating} className="btn-primary w-full sm:w-auto">
          <Plus className="h-4 w-4" /> {creating ? "Creating…" : "New document"}
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

      {documents.length > 0 && <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-ink-100 p-1 dark:bg-ink-800">{[{ value: "all", label: "All documents" }, { value: "mine", label: "Created by me" }].map((item) => <button key={item.value} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === item.value ? "bg-white text-ink-800 shadow-sm dark:bg-ink-700 dark:text-ink-100" : "text-ink-400"}`}>{item.label}</button>)}</div>
        <label className="relative ml-auto min-w-0 flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input aria-label="Search documents" className="input !pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents…" /></label>
        <select aria-label="Sort documents" value={sort} onChange={(e) => setSort(e.target.value)} className="input !w-auto"><option value="updated">Recently updated</option><option value="created">Recently created</option><option value="title">Title A–Z</option></select>
      </div>}

      {documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No documents yet"
          description="Create one and it'll sync live as everyone types, no manual save needed."
          action={
            <button onClick={createDocument} disabled={creating} className="btn-secondary">
              <Plus className="h-4 w-4" /> New document
            </button>
          }
        />
      ) : visibleDocuments.length === 0 ? (
        <EmptyState icon={<Search className="h-5 w-5" />} title="No matching documents" description="Try another title or show all documents." action={<button className="btn-secondary" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button>} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleDocuments.map((doc) => {
            const canManage = can(access, "documents.manage") || doc.createdBy.id === user.id;
            return (
              <div
                key={doc.id}
                className="card group flex flex-col gap-3 p-4 transition-colors hover:border-brand-300 dark:hover:border-brand-500"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500 dark:bg-ink-700">
                    <FileText className="h-4 w-4" />
                  </span>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-colors focus-within:opacity-100 group-hover:opacity-100 touch:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAccessDoc(doc);
                        }}
                        title="Document access"
                        aria-label="Document access"
                        className="rounded-lg p-1.5 text-ink-300 touch:p-2 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => deleteDocument(e, doc.id)}
                        title="Delete document"
                        aria-label="Delete document"
                        className="rounded-lg p-1.5 text-ink-300 touch:p-2 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <Link to={`/workspaces/${workspaceId}/docs/${doc.id}`} className="min-w-0 rounded-sm outline-offset-4 hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{doc.title}</p>
                    {doc.visibility === "ASSIGNED" && <Lock className="h-3 w-3 shrink-0 text-accent-500" />}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-400">
                    Updated {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                  </p>
                </Link>
                <div className="mt-auto flex items-center gap-1.5 text-xs text-ink-400">
                  <Avatar name={doc.createdBy.name} color={doc.createdBy.avatarColor} size={16} />
                  <span className="truncate">{doc.createdBy.name}</span>
                  {doc.visibility === "ASSIGNED" && doc.assignees?.length > 0 && (
                    <span className="truncate">· assigned to {doc.assignees.map((a) => a.name).join(", ")}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DocumentAccessModal
        open={!!accessDoc}
        onClose={() => setAccessDoc(null)}
        workspaceId={workspaceId}
        members={members}
        document={accessDoc}
        onSaved={(saved) => setDocuments((prev) => prev.map((d) => (d.id === saved.id ? saved : d)))}
      />
    </div>
  );
}

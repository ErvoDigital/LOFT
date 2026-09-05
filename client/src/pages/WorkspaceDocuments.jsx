import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { FileText, Plus, Trash2 } from "lucide-react";
import * as documentsApi from "../api/documents.js";
import * as workspacesApi from "../api/workspaces.js";
import { apiErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import Avatar from "../components/common/Avatar.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Spinner from "../components/common/Spinner.jsx";

const DOCUMENT_EVENTS = ["document:created", "document:renamed", "document:updated", "document:deleted"];

export default function WorkspaceDocuments() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [documents, setDocuments] = useState([]);
  const [myRole, setMyRole] = useState("MEMBER");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    Promise.all([documentsApi.listDocuments(workspaceId), workspacesApi.getWorkspace(workspaceId)])
      .then(([docs, ws]) => {
        setDocuments(docs);
        setMyRole(ws.myRole);
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
    if (!confirm("Delete this document for everyone?")) return;
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
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-800">Docs</h1>
          <p className="text-sm text-ink-400">Shared documents everyone in this workspace can co-edit.</p>
        </div>
        <button onClick={createDocument} disabled={creating} className="btn-primary">
          <Plus className="h-4 w-4" /> New document
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

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
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => {
            const canDelete = myRole === "ADMIN" || doc.createdBy.id === user.id;
            return (
              <div
                key={doc.id}
                onClick={() => navigate(`/workspaces/${workspaceId}/docs/${doc.id}`)}
                className="card group flex cursor-pointer flex-col gap-3 p-4 transition-colors hover:border-brand-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                    <FileText className="h-4 w-4" />
                  </span>
                  {canDelete && (
                    <button
                      onClick={(e) => deleteDocument(e, doc.id)}
                      title="Delete document"
                      aria-label="Delete document"
                      className="rounded-lg p-1.5 text-ink-300 opacity-0 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-800">{doc.title}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    Updated {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                  </p>
                </div>
                <div className="mt-auto flex items-center gap-1.5 text-xs text-ink-400">
                  <Avatar name={doc.createdBy.name} color={doc.createdBy.avatarColor} size={16} />
                  <span className="truncate">{doc.createdBy.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

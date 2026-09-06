import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { yUndoPluginKey } from "@tiptap/y-tiptap";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, LineHeight } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import ImageExtension from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import * as Y from "yjs";
import { ArrowLeft, Lock } from "lucide-react";
import * as documentsApi from "../api/documents.js";
import * as workspacesApi from "../api/workspaces.js";
import { apiErrorMessage } from "../api/client.js";
import { exportDocument } from "../lib/documentExport.js";
import { fileToDataUri, pickImageFile } from "../lib/documentImageUpload.js";
import { SuggestionInsert, SuggestionMode, countSuggestions } from "../lib/tiptapSuggestion.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { SocketYjsProvider } from "../lib/yjsSocketProvider.js";
import Avatar from "../components/common/Avatar.jsx";
import Spinner from "../components/common/Spinner.jsx";
import DocumentToolbar from "../components/documents/DocumentToolbar.jsx";
import DocumentMenuBar from "../components/documents/DocumentMenuBar.jsx";
import ModeSwitcher from "../components/documents/ModeSwitcher.jsx";
import SuggestionBar from "../components/documents/SuggestionBar.jsx";
import FindReplacePanel from "../components/documents/FindReplacePanel.jsx";
import WordCountModal from "../components/documents/WordCountModal.jsx";
import DocumentDetailsModal from "../components/documents/DocumentDetailsModal.jsx";
import DocumentAccessModal from "../components/documents/DocumentAccessModal.jsx";

const PAGE_WIDTH = { letter: "max-w-[816px]", a4: "max-w-[794px]" };

function TiptapEditor({ ydoc, provider, user, onReady, pageless, pageSize, columns, mode, findReplaceOpen, onCloseFindReplace }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: false, // Yjs's Collaboration extension owns undo/redo (see its addCommands/addKeyboardShortcuts)
        link: { openOnClick: false, autolink: true },
      }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCaret.configure({ provider, user: { name: user.name, color: user.avatarColor } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      LineHeight,
      Color,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      TaskList,
      TaskItem.configure({ nested: true }),
      ImageExtension,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      SuggestionInsert,
      SuggestionMode,
    ],
    editorProps: {
      attributes: { class: "doc-content px-20 py-16 focus:outline-none" },
    },
    onCreate: ({ editor }) => onReady?.(editor),
  });

  // Viewing = read-only; Suggesting tags this user's new insertions via the
  // SuggestionMode extension's plugin (reads its storage fresh per
  // transaction, so a plain mutation here — no editor.commands round trip
  // needed — is picked up correctly).
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(mode !== "viewing");
    editor.storage.suggestionMode.active = mode === "suggesting";
    editor.storage.suggestionMode.userName = user.name;
  }, [editor, mode, user.name]);

  // The toolbar's Undo/Redo buttons re-render on ProseMirror transactions
  // (Tiptap's own reactivity), but Yjs's UndoManager commits a stack item on
  // its own internal timer (captureTimeout) — a passive moment with no
  // transaction to trigger a re-render, so the buttons can sit stale/disabled
  // even once undo genuinely becomes available. Dispatching a no-op
  // transaction to force Tiptap's own reactivity doesn't work (it skips
  // notifying listeners for transactions with no doc/selection change), so
  // this drives a real React state update directly instead.
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    if (!editor) return;
    const undoManager = yUndoPluginKey.getState(editor.state)?.undoManager;
    if (!undoManager) return;
    undoManager.on("stack-item-added", forceUpdate);
    undoManager.on("stack-item-popped", forceUpdate);
    return () => {
      undoManager.off("stack-item-added", forceUpdate);
      undoManager.off("stack-item-popped", forceUpdate);
    };
  }, [editor]);

  const content = (
    <div className="doc-columns" style={columns > 1 ? { columnCount: columns, columnGap: "2.5rem" } : undefined}>
      <EditorContent editor={editor} />
    </div>
  );

  return (
    <>
      {mode === "suggesting" && <SuggestionBar editor={editor} count={editor ? countSuggestions(editor) : 0} />}
      {mode !== "viewing" && <DocumentToolbar editor={editor} />}
      <div className={`relative flex-1 overflow-y-auto print:overflow-visible print:bg-white ${pageless ? "bg-white" : "bg-ink-100"}`}>
        {findReplaceOpen && <FindReplacePanel editor={editor} onClose={onCloseFindReplace} />}
        {pageless ? (
          content
        ) : (
          <div className={`doc-page mx-auto my-8 min-h-[1056px] ${PAGE_WIDTH[pageSize] || PAGE_WIDTH.letter} rounded-sm bg-white shadow-soft`}>
            {content}
          </div>
        )}
      </div>
    </>
  );
}

export default function DocumentEditor() {
  const { workspaceId, docId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [meta, setMeta] = useState(null); // { id, title, createdBy, createdAt, updatedAt } from REST
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [peers, setPeers] = useState([]); // [{ userId, name, avatarColor }]
  const [fullscreen, setFullscreen] = useState(false);
  const [pageless, setPageless] = useState(false);
  const [pageSize, setPageSize] = useState("letter");
  const [columns, setColumns] = useState(1);
  const [mode, setMode] = useState("editing");
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [editorInstance, setEditorInstance] = useState(null);
  // Real state, not a ref: a ref mutation doesn't trigger a re-render, so a
  // TiptapEditor remount racing the docId transition (key={docId} changes in
  // the same commit that `ready` is still stale-true from the previous doc)
  // could briefly receive a provider that's already been torn down by the
  // old effect's cleanup — a real crash reproduced via "Make a copy" then
  // navigating to the new doc. State keeps this in lockstep with `ready`.
  const [providerInstance, setProviderInstance] = useState(null);

  const ydoc = useMemo(() => new Y.Doc(), [docId]);
  const titleSaveTimer = useRef(null);
  const titleInputRef = useRef(null);

  // Fast-fail REST check first (real 403/404 page, immediate title paint)
  // before ever touching the socket — matches the pattern used elsewhere in
  // the app of fetching page data via REST before opening a realtime channel.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError("");
    setMeta(null); // re-gates the socket-connect effect below until the new doc's REST fast-fail check resolves
    setEditorInstance(null);
    setFindReplaceOpen(false);
    setMode("editing");
    setColumns(1);
    documentsApi
      .getDocument(workspaceId, docId)
      .then((doc) => {
        if (cancelled) return;
        setMeta(doc);
        setTitle(doc.title);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, docId]);

  useEffect(() => {
    workspacesApi
      .getWorkspace(workspaceId)
      .then((ws) => setMembers(ws.members))
      .catch(() => {});
  }, [workspaceId]);

  useEffect(() => {
    if (!socket || !meta) return;
    const provider = new SocketYjsProvider(socket, docId, ydoc, user);

    provider
      .connect()
      .then((res) => {
        setPeers(res.peers || []);
        setProviderInstance(provider);
        setReady(true);
      })
      .catch((err) => setError(err.message || "Failed to open document"));

    const onPresenceJoin = (peer) => setPeers((prev) => (prev.some((p) => p.userId === peer.userId) ? prev : [...prev, peer]));
    const onPresenceLeave = ({ userId }) => setPeers((prev) => prev.filter((p) => p.userId !== userId));
    const onDeleted = ({ id }) => {
      if (id === docId) navigate(`/workspaces/${workspaceId}/docs`);
    };
    socket.on("document:presence-join", onPresenceJoin);
    socket.on("document:presence-leave", onPresenceLeave);
    socket.on("document:deleted", onDeleted);

    return () => {
      socket.off("document:presence-join", onPresenceJoin);
      socket.off("document:presence-leave", onPresenceLeave);
      socket.off("document:deleted", onDeleted);
      provider.destroy();
      setProviderInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, meta, docId]);

  useEffect(() => () => ydoc.destroy(), [ydoc]);

  // Escape exits fullscreen, matching the standard convention every native
  // fullscreen UI (video players, image viewers) already trains users on.
  useEffect(() => {
    if (!fullscreen) return;
    function onKeyDown(e) {
      if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  function handleTitleChange(next) {
    setTitle(next);
    clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = setTimeout(() => {
      documentsApi.renameDocument(workspaceId, docId, next || "Untitled document").catch(() => {});
    }, 600);
  }

  async function handleNew() {
    try {
      const doc = await documentsApi.createDocument(workspaceId);
      navigate(`/workspaces/${workspaceId}/docs/${doc.id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleMakeCopy() {
    try {
      const newDoc = await documentsApi.createDocument(workspaceId, { title: `Copy of ${title || "Untitled document"}` });
      const fullState = Y.encodeStateAsUpdate(ydoc);
      await new Promise((resolve, reject) => {
        socket.emit("document:join", newDoc.id, (res) => {
          if (res?.error) return reject(new Error(res.error));
          socket.emit("document:update", { documentId: newDoc.id, update: fullState });
          resolve();
        });
      });
      // Restore this socket's server-side "which doc is this for" tracking
      // back to the original — the one-shot join above overwrote it. The
      // navigation below opens a fresh provider for the copy, which
      // re-establishes everything there correctly on its own.
      await new Promise((resolve) => socket.emit("document:join", docId, () => resolve()));
      navigate(`/workspaces/${workspaceId}/docs/${newDoc.id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this document for everyone?")) return;
    try {
      await documentsApi.deleteDocument(workspaceId, docId);
      navigate(`/workspaces/${workspaceId}/docs`);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleInsertImage() {
    const file = await pickImageFile();
    if (!file) return;
    try {
      const dataUri = await fileToDataUri(file);
      editorInstance?.chain().focus().setImage({ src: dataUri }).run();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="font-medium text-ink-700">Couldn't open this document</p>
          <p className="mt-1 text-sm text-ink-400">{error}</p>
          <button onClick={() => navigate(`/workspaces/${workspaceId}/docs`)} className="btn-secondary mt-4">
            Back to Docs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 flex flex-col bg-white" : "flex h-full flex-col bg-white"}>
      <div className="flex items-center gap-3 border-b border-ink-200 px-4 py-3 print:hidden">
        <button
          onClick={() => navigate(`/workspaces/${workspaceId}/docs`)}
          title="Back to Docs"
          aria-label="Back to Docs"
          className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          ref={titleInputRef}
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled document"
          className="min-w-0 flex-1 truncate border-none bg-transparent text-lg font-semibold text-ink-800 outline-none placeholder:text-ink-300"
        />
        {meta?.visibility === "ASSIGNED" && (
          <Lock className="h-3.5 w-3.5 shrink-0 text-accent-500" aria-label="Restricted to the assigned person" />
        )}
        <div className="flex shrink-0 items-center -space-x-2">
          {peers.map((p) => (
            <div key={p.userId} title={p.name} className="ring-2 ring-white rounded-full">
              <Avatar name={p.name} color={p.avatarColor} size={26} />
            </div>
          ))}
        </div>
        <ModeSwitcher mode={mode} onChange={setMode} />
      </div>

      {!ready || !providerInstance ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <DocumentMenuBar
            editor={editorInstance}
            onNew={handleNew}
            onMakeCopy={handleMakeCopy}
            onRename={() => {
              titleInputRef.current?.focus();
              titleInputRef.current?.select();
            }}
            onDelete={handleDelete}
            onDownload={(format) => editorInstance && exportDocument(editorInstance, title, format)}
            onPrint={() => window.print()}
            onFindReplace={() => setFindReplaceOpen(true)}
            onWordCount={() => setWordCountOpen(true)}
            onDetails={() => setDetailsOpen(true)}
            onAccess={() => setAccessOpen(true)}
            onInsertImage={handleInsertImage}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((f) => !f)}
            pageless={pageless}
            onTogglePageless={() => setPageless((p) => !p)}
            pageSize={pageSize}
            onSetPageSize={setPageSize}
            columns={columns}
            onSetColumns={setColumns}
          />
          <TiptapEditor
            key={docId}
            ydoc={ydoc}
            provider={providerInstance}
            user={user}
            onReady={setEditorInstance}
            pageless={pageless}
            pageSize={pageSize}
            columns={columns}
            mode={mode}
            findReplaceOpen={findReplaceOpen}
            onCloseFindReplace={() => setFindReplaceOpen(false)}
          />
        </>
      )}

      <WordCountModal open={wordCountOpen} onClose={() => setWordCountOpen(false)} editor={editorInstance} />
      <DocumentDetailsModal open={detailsOpen} onClose={() => setDetailsOpen(false)} meta={meta} />
      <DocumentAccessModal
        open={accessOpen}
        onClose={() => setAccessOpen(false)}
        workspaceId={workspaceId}
        members={members}
        document={meta}
        onSaved={(saved) => setMeta(saved)}
      />
    </div>
  );
}

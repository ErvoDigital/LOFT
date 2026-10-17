import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { yUndoPluginKey } from "@tiptap/y-tiptap";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, LineHeight, FontFamily, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import ImageExtension from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import * as Y from "yjs";
import { X, Lock, FileText, Plus } from "lucide-react";
import * as documentsApi from "../api/documents.js";
import * as workspacesApi from "../api/workspaces.js";
import { apiErrorMessage } from "../api/client.js";
import { exportDocument } from "../lib/documentExport.js";
import { fileToDataUri, pickImageFile } from "../lib/documentImageUpload.js";
import { SuggestionInsert, SuggestionMode, countSuggestions } from "../lib/tiptapSuggestion.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { SocketYjsProvider, toBase64 } from "../lib/yjsSocketProvider.js";
import { can } from "../lib/access.js";
import { DEFAULT_PAGE_LAYOUT, normalizePageLayout, pageDimensions } from "../lib/documentLayout.js";
import { PageBreak } from "../lib/tiptapPageBreak.js";
import { Pagination } from "../lib/tiptapPagination.js";
import { promptForLink } from "../lib/tiptapLink.js";
import Avatar from "../components/common/Avatar.jsx";
import DocumentHistory from "../components/documents/DocumentHistory.jsx";
import { connectDocumentRecovery } from "../lib/documentRecovery.js";
import Spinner from "../components/common/Spinner.jsx";
import DocumentToolbar from "../components/documents/DocumentToolbar.jsx";
import DocumentMenuBar from "../components/documents/DocumentMenuBar.jsx";
import ModeSwitcher from "../components/documents/ModeSwitcher.jsx";
import SuggestionBar from "../components/documents/SuggestionBar.jsx";
import DocumentCanvas from "../components/documents/DocumentCanvas.jsx";
import PageSetupModal from "../components/documents/PageSetupModal.jsx";
import WordCountModal from "../components/documents/WordCountModal.jsx";
import DocumentDetailsModal from "../components/documents/DocumentDetailsModal.jsx";
import DocumentAccessModal from "../components/documents/DocumentAccessModal.jsx";

function TiptapEditor({ ydoc, provider, user, onReady, pageless, layout, columns, mode, findReplaceOpen, onCloseFindReplace, onPageSetup, onAddPage }) {
  const [pages, setPages] = useState([{ number: 1, from: 0, to: 0 }]);
  const editor = useEditor({
    shouldRerenderOnTransaction: true,
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
      FontFamily,
      FontSize,
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
      PageBreak,
      Pagination.configure({ layout, enabled: !pageless, onPaginate: setPages }),
    ],
    editorProps: {
      attributes: { class: "doc-content focus:outline-none", "aria-label": "Document content" },
    },
    onCreate: ({ editor }) => onReady?.(editor),
  });

  useEffect(() => {
    editor?.commands.setPageLayout(layout, !pageless);
  }, [editor, layout, pageless]);

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

  return (
    <>
      {mode === "suggesting" && <SuggestionBar editor={editor} count={editor ? countSuggestions(editor) : 0} />}
      {mode !== "viewing" && <DocumentToolbar editor={editor} />}
      <DocumentCanvas editor={editor} pages={pages} layout={layout} pageless={pageless} columns={columns} mode={mode} findReplaceOpen={findReplaceOpen} onCloseFindReplace={onCloseFindReplace} onPageSetup={onPageSetup} onAddPage={onAddPage} />
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
  const [actionError, setActionError] = useState("");
  const confirm = useConfirm();
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [peers, setPeers] = useState([]); // [{ userId, name, avatarColor }]
  const [fullscreen, setFullscreen] = useState(false);
  const [pageless, setPageless] = useState(false);
  const [layout, setLayout] = useState(DEFAULT_PAGE_LAYOUT);
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [columns, setColumns] = useState(1);
  const [mode, setMode] = useState("editing");
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [workspaceAccess, setWorkspaceAccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(socket?.connected || false);
  const [editorInstance, setEditorInstance] = useState(null);
  // Real state, not a ref: a ref mutation doesn't trigger a re-render, so a
  // TiptapEditor remount racing the docId transition (key={docId} changes in
  // the same commit that `ready` is still stale-true from the previous doc)
  // could briefly receive a provider that's already been torn down by the
  // old effect's cleanup — a real crash reproduced via "Make a copy" then
  // navigating to the new doc. State keeps this in lockstep with `ready`.
  const [providerInstance, setProviderInstance] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saved"), [recoveryError, setRecoveryError] = useState("");
  const documentReady = ready && providerInstance?.documentId === docId && meta?.id === docId;

  const ydoc = useMemo(() => new Y.Doc(), [docId]);
  useEffect(() => {
    if (!documentReady) return;
    let closed = false, recovery;
    connectDocumentRecovery(user.id, docId, ydoc, setRecoveryError).then((value) => { recovery = value; if (closed) recovery.close(); }).catch(() => setRecoveryError("Offline recovery is unavailable on this device."));
    const status = (event) => { if (event.documentId === docId) setSaveStatus(event.status); };
    const local = () => setSaveStatus("saving");
    ydoc.on("update", local); socket?.on("document:save-status", status);
    return () => { closed = true; recovery?.close(); ydoc.off("update", local); socket?.off("document:save-status", status); };
  }, [documentReady, docId, ydoc, socket, user.id]);
  const titleSaveTimer = useRef(null);
  const titleInputRef = useRef(null);
  const titlePending = useRef(null);
  const titleSaveQueue = useRef(Promise.resolve());
  const currentDocRef = useRef(docId);
  currentDocRef.current = docId;

  // Layout lives in the same Yjs snapshot as content: no separate local
  // preference or database migration is needed to share and retain it.
  useEffect(() => {
    const settings = ydoc.getMap("pageLayout");
    const update = () => setLayout(normalizePageLayout(settings.toJSON()));
    update();
    settings.observe(update);
    return () => settings.unobserve(update);
  }, [ydoc]);

  function applyLayout(next) {
    const value = normalizePageLayout(next);
    ydoc.transact(() => {
      const settings = ydoc.getMap("pageLayout");
      Object.entries(value).forEach(([key, val]) => settings.set(key, val));
    });
    setPageless(false);
  }

  const saveTitle = useCallback((pending) => {
    if (!pending) return;
    if (pending.promise) return pending.promise;
    // Serialize requests so a slow earlier rename cannot overwrite a later
    // title. Blur and navigation can also safely flush the same pending save.
    pending.promise = titleSaveQueue.current.then(async () => {
      try {
        await documentsApi.renameDocument(pending.workspaceId, pending.docId, pending.title.trim() || "Untitled document");
        if (titlePending.current === pending) {
          titlePending.current = null;
          if (currentDocRef.current === pending.docId) setActionError((previous) => previous.startsWith("Title wasn't saved.") ? "" : previous);
        }
      } catch (err) {
        if (currentDocRef.current === pending.docId && titlePending.current === pending) setActionError(`Title wasn't saved. ${apiErrorMessage(err)}`);
      } finally {
        pending.promise = null;
      }
    });
    titleSaveQueue.current = pending.promise;
    return pending.promise;
  }, []);

  useEffect(() => () => {
    clearTimeout(titleSaveTimer.current);
    const pending = titlePending.current;
    titlePending.current = null;
    if (pending?.docId === docId) void saveTitle(pending);
  }, [docId, saveTitle]);

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setConnected(socket.connected);
    return () => { socket.off("connect", onConnect); socket.off("disconnect", onDisconnect); };
  }, [socket]);

  // Fast-fail REST check first (real 403/404 page, immediate title paint)
  // before ever touching the socket — matches the pattern used elsewhere in
  // the app of fetching page data via REST before opening a realtime channel.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError("");
    setActionError("");
    setMeta(null); // re-gates the socket-connect effect below until the new doc's REST fast-fail check resolves
    setEditorInstance(null);
    setFindReplaceOpen(false);
    setMode("editing");
    setColumns(1);
    setPeers([]);
    setPageSetupOpen(false);
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
      .then((ws) => { setMembers(ws.members); setWorkspaceAccess(ws); })
      .catch(() => {});
  }, [workspaceId]);

  useEffect(() => {
    if (!socket || meta?.id !== docId) return;
    let cancelled = false;
    const provider = new SocketYjsProvider(socket, docId, ydoc, user);

    provider
      .connect()
      .then((res) => {
        if (cancelled) return;
        setPeers(res.peers || []);
        setProviderInstance(provider);
        setReady(true);
      })
      .catch((err) => { if (!cancelled) setError(err.message || "Failed to open document"); });

    const onPresenceJoin = (peer) => setPeers((prev) => (prev.some((p) => p.userId === peer.userId) ? prev : [...prev, peer]));
    const onPresenceLeave = ({ userId }) => setPeers((prev) => prev.filter((p) => p.userId !== userId));
    const onDeleted = ({ id }) => {
      if (id === docId) navigate(`/workspaces/${workspaceId}/docs`);
    };
    socket.on("document:presence-join", onPresenceJoin);
    socket.on("document:presence-leave", onPresenceLeave);
    socket.on("document:deleted", onDeleted);

    return () => {
      cancelled = true;
      socket.off("document:presence-join", onPresenceJoin);
      socket.off("document:presence-leave", onPresenceLeave);
      socket.off("document:deleted", onDeleted);
      provider.destroy();
      setProviderInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, meta?.id, docId]);

  useEffect(() => () => ydoc.destroy(), [ydoc]);

  useEffect(() => {
    if (!documentReady) return;
    function shortcuts(event) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.defaultPrevented) return;
      const key = event.key.toLowerCase();
      if (key === "h" && mode !== "viewing") { event.preventDefault(); setFindReplaceOpen(true); }
      if (key === "c" && event.shiftKey) { event.preventDefault(); setWordCountOpen(true); }
      if (key === "k" && mode !== "viewing" && editorInstance) { event.preventDefault(); promptForLink(editorInstance); }
    }
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [documentReady, mode, editorInstance]);

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
    setActionError("");
    clearTimeout(titleSaveTimer.current);
    const pending = { workspaceId, docId, title: next };
    titlePending.current = pending;
    titleSaveTimer.current = setTimeout(() => void saveTitle(pending), 600);
  }

  async function handleNew() {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      const doc = await documentsApi.createDocument(workspaceId);
      navigate(`/workspaces/${workspaceId}/docs/${doc.id}`);
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleMakeCopy() {
    if (busy || !connected) return;
    setBusy(true);
    setActionError("");
    try {
      const newDoc = await documentsApi.createDocument(workspaceId, { title: `Copy of ${title || "Untitled document"}` });
      const fullState = toBase64(Y.encodeStateAsUpdate(ydoc));
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
      setActionError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete this document?",
      subject: title,
      message: "It will be deleted for everyone in this workspace. This can't be undone.",
      confirmLabel: "Delete document",
    });
    if (!ok) return;
    try {
      await documentsApi.deleteDocument(workspaceId, docId);
      navigate(`/workspaces/${workspaceId}/docs`);
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  }

  async function handleInsertImage() {
    const file = await pickImageFile();
    if (!file) return;
    try {
      const dataUri = await fileToDataUri(file);
      editorInstance?.chain().focus().setImage({ src: dataUri }).run();
    } catch (err) {
      setActionError(err.message);
    }
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="font-medium text-ink-700 dark:text-ink-200">Couldn't open this document</p>
          <p className="mt-1 text-sm text-ink-400">{error}</p>
          <button onClick={() => navigate(`/workspaces/${workspaceId}/docs`)} className="btn-secondary mt-4">
            Back to Docs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`document-editor ${fullscreen ? "fixed inset-0 z-50" : "relative h-full"} flex min-h-0 flex-col bg-white dark:bg-ink-900`}>
      <style>{`@media print { @page { size: ${layout.size === "a4" ? "A4" : "letter"} ${layout.orientation}; margin: ${pageDimensions(layout).margin / 96}in; } }`}</style>
      <div className="flex items-center gap-2 border-b border-ink-200 px-2 py-2 dark:border-ink-700 sm:gap-3 sm:px-4 sm:py-3 print:hidden">
        <button
          onClick={() => navigate(`/workspaces/${workspaceId}/docs`)}
          title="Close document"
          aria-label="Close document"
          className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-brand-500/10 hover:text-brand-600 dark:hover:bg-white/[0.08] dark:hover:text-brand-300"
        >
          <X className="h-4 w-4" />
        </button>
        <FileText className="hidden h-5 w-5 shrink-0 text-brand-500 sm:block" />
        <input
          ref={titleInputRef}
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled document"
          aria-label="Document title"
          maxLength={200}
          readOnly={mode === "viewing"}
          onBlur={() => { clearTimeout(titleSaveTimer.current); void saveTitle(titlePending.current); }}
          className="min-w-0 flex-1 truncate border-none bg-transparent text-base font-semibold sm:text-lg text-ink-800 outline-none placeholder:text-ink-400 dark:text-ink-100"
        />
        <span role="status" className="hidden shrink-0 items-center gap-1.5 text-xs text-ink-400 lg:flex"><span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-accent-500"}`} />{connected ? "Live sync" : "Reconnecting"}</span>
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
        {documentReady && <DocumentHistory workspaceId={workspaceId} documentId={docId} editor={editorInstance} ydoc={ydoc} onLayout={applyLayout} onTitle={handleTitleChange} />}
        {documentReady && mode !== "viewing" && <button onClick={() => { editorInstance?.chain().addPage().run(); setPageless(false); }} disabled={!editorInstance} aria-label="Add page" className="btn-primary shrink-0 !px-2.5 !py-1.5 !text-xs"><Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Add page</span></button>}
      </div>

      {actionError && <div role="alert" className="flex items-center justify-between gap-3 bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400 print:hidden"><span>{actionError}</span><div className="flex shrink-0 gap-3">{titlePending.current && <button onClick={() => void saveTitle(titlePending.current)} className="font-medium underline">Retry title save</button>}<button onClick={() => setActionError("")} aria-label="Dismiss error"><X className="h-4 w-4" /></button></div></div>}
      {!connected && ready && <div role="status" className="bg-accent-50 px-4 py-2 text-xs text-accent-700 dark:bg-accent-500/10 dark:text-accent-400 print:hidden">Connection lost. Keep this tab open; your changes will sync when you reconnect.</div>}

      {documentReady && <p role="status" className={`px-4 py-1 text-xs print:hidden ${saveStatus === "error" ? "bg-red-500/10 text-red-600" : "text-ink-400"}`}>{!connected ? "Offline · changes will sync when connected" : saveStatus === "error" ? "Save failed. Retrying automatically; keep this tab open." : saveStatus === "saving" ? "Saving changes…" : "All changes saved"}{recoveryError ? ` · ${recoveryError}` : ""}</p>}
      {!documentReady ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <DocumentMenuBar
            editor={editorInstance}
            editable={mode !== "viewing"}
            busy={busy}
            canManage={meta?.createdBy.id === user.id || can(workspaceAccess, "documents.manage")}
            onNew={handleNew}
            onMakeCopy={handleMakeCopy}
            onRename={() => {
              titleInputRef.current?.focus();
              titleInputRef.current?.select();
            }}
            onDelete={handleDelete}
            onDownload={(format) => editorInstance && exportDocument(editorInstance, title, format, layout)}
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
            pageSize={layout.size}
            onSetPageSize={(size) => applyLayout({ ...layout, size })}
            onPageSetup={() => setPageSetupOpen(true)}
            onAddPage={() => setPageless(false)}
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
            layout={layout}
            columns={columns}
            mode={mode}
            findReplaceOpen={findReplaceOpen}
            onCloseFindReplace={() => setFindReplaceOpen(false)}
            onPageSetup={() => setPageSetupOpen(true)}
            onAddPage={() => setPageless(false)}
          />
        </>
      )}

      <WordCountModal open={wordCountOpen} onClose={() => setWordCountOpen(false)} editor={editorInstance} />
      <PageSetupModal open={pageSetupOpen} onClose={() => setPageSetupOpen(false)} layout={layout} onApply={applyLayout} />
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

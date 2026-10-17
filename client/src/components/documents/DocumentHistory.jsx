import { useState } from "react";
import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "@tiptap/y-tiptap";
import * as documentsApi from "../../api/documents.js";
import { toBase64 } from "../../lib/yjsSocketProvider.js";
import { apiErrorMessage } from "../../api/client.js";
import Modal from "../common/Modal.jsx";

export default function DocumentHistory({ workspaceId, documentId, editor, ydoc, onLayout, onTitle }) {
  const [open, setOpen] = useState(false), [revisions, setRevisions] = useState([]), [selected, setSelected] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function run(action) { setBusy(true); setError(""); try { await action(); } catch (err) { setError(apiErrorMessage(err)); } finally { setBusy(false); } }
  const reload = async () => setRevisions(await documentsApi.listRevisions(workspaceId, documentId));
  async function inspect(revision) {
    const snapshot = await documentsApi.getRevision(workspaceId, documentId, revision.id), doc = new Y.Doc();
    try {
      Y.applyUpdate(doc, Uint8Array.from(atob(snapshot.content), (letter) => letter.charCodeAt(0)));
      const json = yDocToProsemirrorJSON(doc, "default");
      setSelected({ ...snapshot, json, preview: editor.schema.nodeFromJSON(json).textContent, layout: doc.getMap("pageLayout").toJSON() });
    } finally { doc.destroy(); }
  }
  return <><button type="button" className="btn-secondary !px-2 !py-1.5 !text-xs" disabled={!editor} onClick={() => { setOpen(true); setSelected(null); run(reload); }}>Version history</button>
    <Modal open={open} onClose={() => setOpen(false)} title="Document versions" width="max-w-xl">
      <p className="text-xs text-ink-500">Restoring creates new shared edits. Your current content is saved as a recovery version first.</p>
      <button type="button" className="btn-primary my-3 !text-xs" disabled={busy} onClick={() => run(async () => { await documentsApi.createRevision(workspaceId, documentId, toBase64(Y.encodeStateAsUpdate(ydoc))); await reload(); })}>Save a version now</button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="max-h-48 space-y-1 overflow-y-auto">{revisions.map((item) => <button type="button" key={item.id} className="block w-full rounded-lg p-2 text-left text-sm hover:bg-brand-500/10" disabled={busy} onClick={() => run(() => inspect(item))}>{item.title} · {new Date(item.createdAt).toLocaleString()}</button>)}</div>
      {selected && <div className="mt-4 space-y-3"><p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ink-500/5 p-3 text-sm">{selected.preview || "Empty document"}</p><button type="button" className="btn-primary" disabled={busy} onClick={() => run(async () => {
        await documentsApi.createRevision(workspaceId, documentId, toBase64(Y.encodeStateAsUpdate(ydoc)));
        if (!editor.commands.setContent(selected.json, { errorOnInvalidContent: true })) throw new Error("Could not restore this version");
        if (Object.keys(selected.layout).length) onLayout(selected.layout);
        onTitle(selected.title); setOpen(false);
      })}>Confirm restore this version</button></div>}
    </Modal></>;
}

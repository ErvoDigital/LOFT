import { useState } from "react";
import * as assetsApi from "../../api/assets.js";
import { apiErrorMessage } from "../../api/client.js";
import { useConfirm } from "../../context/ConfirmContext.jsx";
import Modal from "../common/Modal.jsx";

export default function RecycleBin({ workspaceId, onChanged }) {
  const [open, setOpen] = useState(false), [assets, setAssets] = useState([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const reload = async () => setAssets(await assetsApi.listTrash(workspaceId));
  async function run(action) { setBusy(true); setError(""); try { await action(); } catch (err) { setError(apiErrorMessage(err)); } finally { setBusy(false); } }
  return <><button type="button" className="btn-secondary !text-xs" onClick={() => { setOpen(true); run(reload); }}>Recycle bin</button>
    <Modal open={open} onClose={() => setOpen(false)} title="Recycle bin" width="max-w-lg">
      <p className="mb-3 text-xs text-ink-500">Restore files with all their versions, or permanently delete them.</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!assets.length && !busy && <p className="text-sm text-ink-400">No deleted files you can manage.</p>}
      <ul className="space-y-3">{assets.map((asset) => <li key={asset.id} className="rounded-lg border border-ink-200 p-3 dark:border-ink-700"><p className="truncate text-sm font-medium">{asset.name}</p><p className="text-xs text-ink-400">{asset.versionCount} versions · deleted {new Date(asset.deletedAt).toLocaleString()}</p><div className="mt-2 flex gap-3"><button type="button" className="text-xs text-brand-600" disabled={busy} onClick={() => run(async () => { await assetsApi.restoreAsset(workspaceId, asset.id); await reload(); onChanged(); })}>Restore</button><button type="button" className="text-xs text-red-600" disabled={busy} onClick={async () => { if (await confirm({ title: "Permanently delete this file?", subject: asset.name, message: "All versions will be removed. This cannot be undone.", confirmLabel: "Delete permanently" })) run(async () => { await assetsApi.purgeAsset(workspaceId, asset.id); await reload(); }); }}>Delete permanently</button></div></li>)}</ul>
    </Modal></>;
}

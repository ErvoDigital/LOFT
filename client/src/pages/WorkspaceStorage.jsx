import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ChevronRight, FolderOpen, FolderPlus, UploadCloud } from "lucide-react";
import * as assetsApi from "../api/assets.js";
import * as foldersApi from "../api/folders.js";
import * as workspacesApi from "../api/workspaces.js";
import { apiErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import AssetCard from "../components/storage/AssetCard.jsx";
import FolderCard from "../components/storage/FolderCard.jsx";
import FolderModal from "../components/storage/FolderModal.jsx";
import MoveToFolderModal from "../components/storage/MoveToFolderModal.jsx";
import PreviewModal from "../components/storage/PreviewModal.jsx";
import UploadProgressPanel from "../components/storage/UploadProgressPanel.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Spinner from "../components/common/Spinner.jsx";

const ASSET_EVENTS = ["asset:created", "asset:updated", "asset:merged", "asset:deleted"];
const FOLDER_EVENTS = ["folder:created", "folder:updated", "folder:deleted"];

export default function WorkspaceStorage() {
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get("folder");

  const [assets, setAssets] = useState([]);
  const [folders, setFolders] = useState([]);
  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState("MEMBER");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [versionUploads, setVersionUploads] = useState(new Map()); // assetId -> percent, for version-upload cards
  const [newUploads, setNewUploads] = useState([]); // [{ id, name, size, progress }], for the floating panel
  const [folderModal, setFolderModal] = useState(null); // { folder } | { parentId } | null
  const [movingAsset, setMovingAsset] = useState(null);
  const [previewing, setPreviewing] = useState(null); // { asset, version } | null
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    Promise.all([assetsApi.listAssets(workspaceId), foldersApi.listFolders(workspaceId), workspacesApi.getWorkspace(workspaceId)]).then(
      ([a, f, ws]) => {
        setAssets(a);
        setFolders(f);
        setMyRole(ws.myRole);
        setMembers(ws.members);
        setLoading(false);
      }
    );
  }, [workspaceId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => load();
    [...ASSET_EVENTS, ...FOLDER_EVENTS].forEach((e) => socket.on(e, handler));
    return () => [...ASSET_EVENTS, ...FOLDER_EVENTS].forEach((e) => socket.off(e, handler));
  }, [socket, load]);

  const currentFolder = currentFolderId ? folders.find((f) => f.id === currentFolderId) : null;

  // A folder id in the URL that the server didn't hand back (deleted, or
  // restricted and inaccessible) — bounce back to root rather than showing
  // an empty page with no way out.
  useEffect(() => {
    if (!loading && currentFolderId && !currentFolder) setSearchParams({});
  }, [loading, currentFolderId, currentFolder, setSearchParams]);

  const breadcrumb = [];
  for (let f = currentFolder; f; f = folders.find((x) => x.id === f.parentId)) breadcrumb.unshift(f);

  const childFolders = folders.filter((f) => f.parentId === currentFolderId);
  const childAssets = assets.filter((a) => a.folderId === currentFolderId);

  function navigate(folderId) {
    setSearchParams(folderId ? { folder: folderId } : {});
  }

  async function uploadNew(file, folderId = currentFolderId) {
    setError("");
    const uploadId = `${Date.now()}-${Math.random()}`;
    setNewUploads((prev) => [...prev, { id: uploadId, name: file.name, size: file.size, progress: 0 }]);
    try {
      await assetsApi.uploadAsset(workspaceId, file, folderId, (evt) => {
        if (!evt.total) return;
        const progress = Math.round((evt.loaded / evt.total) * 100);
        setNewUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress } : u)));
      });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setNewUploads((prev) => prev.filter((u) => u.id !== uploadId));
    }
  }

  async function uploadVersionFor(assetId, file) {
    setError("");
    setVersionUploads((prev) => new Map(prev).set(assetId, 0));
    try {
      await assetsApi.uploadVersion(workspaceId, assetId, file, (evt) => {
        if (!evt.total) return;
        const progress = Math.round((evt.loaded / evt.total) * 100);
        setVersionUploads((prev) => new Map(prev).set(assetId, progress));
      });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setVersionUploads((prev) => {
        const next = new Map(prev);
        next.delete(assetId);
        return next;
      });
    }
  }

  async function merge(targetAssetId, sourceAssetId) {
    setError("");
    try {
      await assetsApi.mergeAssets(workspaceId, targetAssetId, sourceAssetId);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function moveAssetTo(assetId, folderId) {
    setError("");
    try {
      await assetsApi.moveAsset(workspaceId, assetId, folderId);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function remove(assetId) {
    if (!confirm("Delete this file and all its versions?")) return;
    try {
      await assetsApi.deleteAsset(workspaceId, assetId);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  // Attached to the whole content pane (not just the visual dropzone box)
  // so dropping a file works anywhere on the page, not only when the empty
  // -state box happens to be showing. Cards/folder tiles stopPropagation on
  // their own drag events, so a drop that lands on one of them (merge,
  // add-version, move-into-folder) never reaches this fallback handler.
  function handlePageDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setDropzoneActive(true);
  }

  function handlePageDragLeave() {
    setDropzoneActive(false);
  }

  function handlePageDrop(e) {
    e.preventDefault();
    setDropzoneActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    files.forEach((file) => uploadNew(file));
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    // Full-bleed drop target: spans the whole content pane (not just the
    // centered/padded column below), so a file can be dropped anywhere on
    // the page — including the empty margins and the space below a short
    // grid — and it still uploads to the folder currently being viewed.
    <div
      className="relative min-h-full"
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1 text-sm">
              <button onClick={() => navigate(null)} className="font-semibold text-ink-900 hover:text-brand-600">
                Storage
              </button>
              {breadcrumb.map((f) => (
                <span key={f.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 text-ink-300" />
                  <button onClick={() => navigate(f.id)} className="font-semibold text-ink-900 hover:text-brand-600">
                    {f.name}
                  </button>
                </span>
              ))}
            </div>
            <p className="text-xs text-ink-400">Drag a new take onto an existing file to save it as the next version.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setFolderModal({ parentId: currentFolderId })}>
              <FolderPlus className="mr-1.5 inline h-4 w-4" />
              New folder
            </button>
            <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
              + Upload
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              if (e.target.files[0]) uploadNew(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {childAssets.length === 0 && (
          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm transition-colors ${
              dropzoneActive ? "border-brand-400 bg-brand-50 text-brand-700" : "border-ink-200 bg-white text-ink-400"
            }`}
          >
            <UploadCloud className="h-5 w-5" />
            Drop a video or file here to upload
          </div>
        )}

        {childFolders.length === 0 && childAssets.length === 0 ? (
          <EmptyState icon={<FolderOpen className="h-5 w-5" />} title="Nothing here yet" description="Upload a file or create a folder to get started." />
        ) : (
          <div className="space-y-5">
            {childFolders.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {childFolders.map((f) => (
                  <FolderCard
                    key={f.id}
                    folder={f}
                    canManage={myRole === "ADMIN" || f.createdBy.id === user.id}
                    onOpen={navigate}
                    onEdit={(folder) => setFolderModal({ folder })}
                    onDelete={async (folderId) => {
                      if (!confirm("Delete this folder? It must be empty first.")) return;
                      try {
                        await foldersApi.deleteFolder(workspaceId, folderId);
                        load();
                      } catch (err) {
                        setError(apiErrorMessage(err));
                      }
                    }}
                    onAssetDrop={moveAssetTo}
                    onFileDrop={(folderId, file) => uploadNew(file, folderId)}
                  />
                ))}
              </div>
            )}

            {childFolders.length > 0 && childAssets.length > 0 && <hr className="border-ink-200" />}

            {childAssets.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {childAssets.map((a) => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    canManage={myRole === "ADMIN" || a.uploadedBy.id === user.id}
                    uploadProgress={versionUploads.get(a.id)}
                    onDropFile={(file) => uploadVersionFor(a.id, file)}
                    onMergeDrop={(sourceId) => merge(a.id, sourceId)}
                    onDownload={(version) => assetsApi.downloadVersion(workspaceId, a.id, version)}
                    onPreview={(version) => setPreviewing({ asset: a, version })}
                    onMove={setMovingAsset}
                    onDelete={remove}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <FolderModal
          open={!!folderModal}
          onClose={() => setFolderModal(null)}
          workspaceId={workspaceId}
          members={members}
          parentId={folderModal?.parentId ?? folderModal?.folder?.parentId ?? null}
          folder={folderModal?.folder}
          onSaved={load}
          onDeleted={(folderId) => {
            if (folderId === currentFolderId) navigate(currentFolder?.parentId || null);
            load();
          }}
        />

        <MoveToFolderModal
          open={!!movingAsset}
          onClose={() => setMovingAsset(null)}
          folders={folders}
          currentFolderId={movingAsset?.folderId ?? null}
          onMove={(folderId) => moveAssetTo(movingAsset.id, folderId)}
        />

        <PreviewModal
          open={!!previewing}
          onClose={() => setPreviewing(null)}
          workspaceId={workspaceId}
          assetId={previewing?.asset.id}
          version={previewing?.version}
          name={previewing?.asset.name}
          onDownload={() => assetsApi.downloadVersion(workspaceId, previewing.asset.id, previewing.version)}
        />
      </div>

      {/* Covers the exact drop target above — appears only while a real file
          drag is over it, so "you can drop here" is never a promise the
          rest of the page can't keep (an internal asset-card drag doesn't
          trigger it, since that isn't a valid drop here). */}
      {dropzoneActive && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center border-4 border-dashed border-brand-400 bg-brand-500/10">
          <div className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 shadow-panel">
            <UploadCloud className="h-5 w-5 text-brand-600" />
            <span className="text-sm font-medium text-brand-700">Drop to upload</span>
          </div>
        </div>
      )}

      <UploadProgressPanel uploads={newUploads} />
    </div>
  );
}

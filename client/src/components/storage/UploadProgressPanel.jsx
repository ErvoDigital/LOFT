import { UploadCloud } from "lucide-react";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// A file's size determines how long it visibly spends at each percentage —
// a 20MB image finishes almost instantly, a 400MB video crawls through the
// bar — so no extra logic is needed to make the "effect" depend on size:
// real byte progress from the upload already behaves that way.
export default function UploadProgressPanel({ uploads }) {
  if (uploads.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 space-y-2">
      {uploads.map((u) => (
        <div key={u.id} className="card p-3 shadow-panel">
          <div className="mb-1.5 flex items-center gap-2">
            <UploadCloud className="h-3.5 w-3.5 shrink-0 text-brand-500" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-700">{u.name}</span>
            <span className="shrink-0 text-xs text-ink-400">{formatSize(u.size)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-200"
              style={{ width: `${u.progress}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

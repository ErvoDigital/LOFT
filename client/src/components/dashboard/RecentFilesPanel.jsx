import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, FolderOpen } from "lucide-react";
import { FileIcon, formatSize, timeAgo } from "../../lib/fileIcons.jsx";
import EmptyState from "../common/EmptyState.jsx";

// A flat, searchable list of the most recently touched files rather than a
// full folder tree — there's no cross-workspace tree endpoint, and the panel's
// job is "find the thing I was just working on", which recency serves better.
export default function RecentFilesPanel({ files, showWorkspace = true, workspaceId }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files || [];
    return (files || []).filter(
      (f) => f.name.toLowerCase().includes(q) || (f.workspaceName || "").toLowerCase().includes(q)
    );
  }, [files, query]);

  function storageLink(file) {
    const wsId = file.workspaceId || workspaceId;
    return file.folderId ? `/workspaces/${wsId}/storage?folder=${file.folderId}` : `/workspaces/${wsId}/storage`;
  }

  if (!files || files.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen className="h-5 w-5" />}
        title="No files yet"
        description="Files uploaded to storage will show up here."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files…"
          aria-label="Search files"
          className="input pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">No files match “{query}”.</p>
      ) : (
        <div className="space-y-1">
          {filtered.map((f) => (
            <Link
              key={f.id}
              to={storageLink(f)}
              className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-brand-500/[0.07]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-900/[0.05] text-ink-500 transition-colors group-hover:bg-brand-500/15 group-hover:text-brand-600 dark:bg-white/[0.06] dark:group-hover:text-brand-300">
                <FileIcon mimeType={f.latestVersion?.mimeType} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800 group-hover:text-brand-700 dark:text-ink-100 dark:group-hover:text-brand-300">
                  {f.name}
                </p>
                <p className="truncate text-xs text-ink-400">
                  {showWorkspace && f.workspaceName ? `${f.workspaceName} · ` : ""}
                  {f.latestVersion ? `${formatSize(f.latestVersion.size)} · ` : ""}
                  {timeAgo(f.updatedAt)}
                </p>
              </div>
              {f.latestVersion?.version > 1 && (
                <span className="chip shrink-0 !px-2 !py-0.5 font-semibold text-brand-600 dark:text-brand-300">
                  V{f.latestVersion.version}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

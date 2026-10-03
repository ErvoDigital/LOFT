import { can } from "./permissions.js";

function isDirectlyVisible(userId, folder) {
  if (!folder) return false;
  if (folder.createdById === userId) return true;
  if (folder.visibility === "WORKSPACE") return true;
  return folder.members.some((m) => m.userId === userId);
}

// Every folder in the ancestry must be visible. Callers pass a map containing
// the workspace's folders; when an ancestor cannot be resolved, access fails
// closed rather than treating the child as a new root.
export function isFolderVisible(userId, membership, folder, folderById = new Map()) {
  const ancestry = resolveFolderAncestry(folder, folderById);
  if (!ancestry) return false;
  if (can(membership, "files.viewAll")) return true;
  return ancestry.every((ancestor) => isDirectlyVisible(userId, ancestor));
}

// Resolves the complete chain before callers apply any permission override.
// A null result means the hierarchy is structurally unsafe: either an ancestor
// is missing from the workspace map or the chain contains a cycle.
export function resolveFolderAncestry(folder, folderById = new Map()) {
  if (!folder) return null;

  const ancestry = [];
  const visited = new Set();
  let cursor = folder;
  while (cursor) {
    if (visited.has(cursor.id)) return null;
    visited.add(cursor.id);
    ancestry.push(cursor);
    if (!cursor.parentId) return ancestry;
    cursor = folderById.get(cursor.parentId);
    if (!cursor) return null;
  }
  return null;
}

// files.manage reaches other people's folders, but only ones the caller can
// see — managing a restricted folder isn't a back door into reading it.
// `folder` needs its members loaded.
export function canManageFolder(userId, membership, folder, folderById = new Map()) {
  if (!isFolderVisible(userId, membership, folder, folderById)) return false;
  return folder.createdById === userId || can(membership, "files.manage");
}

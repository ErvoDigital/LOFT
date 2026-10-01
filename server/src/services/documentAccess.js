import { can } from "./permissions.js";

// A document is visible to a member if they hold documents.viewAll (every
// admin does), they created it, its visibility is WORKSPACE, or they're
// explicitly listed in its assignees. Same shape as folderAccess.js's
// isFolderVisible/FolderMember. `membership` is the caller's WorkspaceMember row.
export function isDocumentVisible(userId, membership, document) {
  if (!document) return true;
  if (can(membership, "documents.viewAll")) return true;
  if (document.createdById === userId) return true;
  if (document.visibility === "WORKSPACE") return true;
  return document.assignees.some((a) => a.userId === userId);
}

// documents.manage reaches other people's documents, but only ones the caller
// can open. `document` needs its assignees loaded.
export function canManageDocument(userId, membership, document) {
  if (document.createdById === userId) return true;
  return can(membership, "documents.manage") && isDocumentVisible(userId, membership, document);
}

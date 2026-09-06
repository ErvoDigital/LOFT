// A document is visible to a member if they're a workspace ADMIN, they
// created it, its visibility is WORKSPACE, or they're explicitly listed in
// its assignees. Same shape as folderAccess.js's isFolderVisible/FolderMember.
export function isDocumentVisible(userId, role, document) {
  if (!document) return true;
  if (role === "ADMIN") return true;
  if (document.createdById === userId) return true;
  if (document.visibility === "WORKSPACE") return true;
  return document.assignees.some((a) => a.userId === userId);
}

export function canManageDocument(userId, role, document) {
  return role === "ADMIN" || document.createdById === userId;
}

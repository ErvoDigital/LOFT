// A folder is visible to a member if they're a workspace ADMIN, they created
// it, it's not restricted, or they're explicitly listed as a FolderMember.
// Restricting a folder restricts everything inside it — there's no
// independent per-file visibility (see schema.prisma's Folder doc comment).
export function isFolderVisible(userId, role, folder) {
  if (!folder) return true;
  if (role === "ADMIN") return true;
  if (folder.createdById === userId) return true;
  if (folder.visibility === "WORKSPACE") return true;
  return folder.members.some((m) => m.userId === userId);
}

export function canManageFolder(userId, role, folder) {
  return role === "ADMIN" || folder.createdById === userId;
}

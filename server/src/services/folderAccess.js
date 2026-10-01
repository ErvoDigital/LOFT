import { can } from "./permissions.js";

// A folder is visible to a member if they hold files.viewAll (every admin
// does), they created it, it's not restricted, or they're explicitly listed
// as a FolderMember. Restricting a folder restricts everything inside it —
// there's no independent per-file visibility (see schema.prisma's Folder doc
// comment). `membership` is the caller's WorkspaceMember row.
export function isFolderVisible(userId, membership, folder) {
  if (!folder) return true;
  if (can(membership, "files.viewAll")) return true;
  if (folder.createdById === userId) return true;
  if (folder.visibility === "WORKSPACE") return true;
  return folder.members.some((m) => m.userId === userId);
}

// files.manage reaches other people's folders, but only ones the caller can
// see — managing a restricted folder isn't a back door into reading it.
// `folder` needs its members loaded.
export function canManageFolder(userId, membership, folder) {
  if (folder.createdById === userId) return true;
  return can(membership, "files.manage") && isFolderVisible(userId, membership, folder);
}

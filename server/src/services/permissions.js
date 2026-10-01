// Workspace abilities: the admin-only actions an admin can hand to a single
// member from the workspace's Members list. ADMINs hold every one of them; a
// MEMBER holds only the ones granted to them, stored on
// WorkspaceMember.permissions as a comma-separated list of these keys (the
// schema stays free of arrays/Json for portability). Every server-side check
// that used to read `role === "ADMIN"` goes through can() instead, so a
// granted ability unlocks exactly that check and nothing next to it.
//
// Changing anyone's access or role is deliberately not in this list: it is
// how abilities are granted, so it stays with the admins.
export const PERMISSIONS = [
  "workspace.edit", // name, description, type, color, logo
  "members.manage", // remove members, hear about new joiners
  "tasks.status", // move any task between statuses, not just their own
  "statuses.manage", // the task board's columns
  "events.manage", // edit or cancel any calendar event
  "channels.manage", // create channels, delete them for everyone
  "messages.moderate", // delete anyone's message in a workspace channel
  "files.viewAll", // see restricted folders they aren't listed on
  "files.manage", // move/delete anyone's files, change anyone's folders
  "documents.viewAll", // open documents restricted to their assignees
  "documents.manage", // change access on, or delete, anyone's document
];

export function parsePermissions(value) {
  if (!value) return [];
  return value.split(",").filter((key) => PERMISSIONS.includes(key));
}

// Canonical order and no duplicates, so two equal grants store identically.
export function serializePermissions(keys) {
  return PERMISSIONS.filter((key) => keys.includes(key)).join(",");
}

// The caller's full ability list, as the client sees it on a workspace.
export function permissionsOf(membership) {
  if (!membership) return [];
  if (membership.role === "ADMIN") return [...PERMISSIONS];
  return parsePermissions(membership.permissions);
}

export function can(membership, permission) {
  if (!membership) return false;
  if (membership.role === "ADMIN") return true;
  return parsePermissions(membership.permissions).includes(permission);
}

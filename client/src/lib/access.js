import { Building2, FolderOpen, ListChecks, Users } from "lucide-react";

// Workspace abilities: the admin-only actions an admin can hand to a single
// member from Settings → Members → Access. The keys mirror the server's
// services/permissions.js, which is what actually enforces them; this file
// only describes them and decides what the UI shows. Grouped by the part of
// LOFT each one unlocks.
export const ABILITY_GROUPS = [
  {
    key: "work",
    name: "Work",
    summary: "Task board and calendar",
    Icon: ListChecks,
    abilities: [
      {
        key: "tasks.status",
        label: "Change any task's status",
        description: "Move any task to any status on the board. Without this, only the tasks assigned to them.",
      },
      {
        key: "statuses.manage",
        label: "Customize task statuses",
        description: "Add, rename, recolor, reorder and remove the columns on the task board.",
      },
      {
        key: "events.manage",
        label: "Edit and cancel events",
        description: "Change or cancel any event on the shared calendar. Everyone can already add one.",
      },
    ],
  },
  {
    key: "people",
    name: "People",
    summary: "Members and chat",
    Icon: Users,
    abilities: [
      {
        key: "members.manage",
        label: "Remove members",
        description: "Take people out of the workspace, and get a heads-up whenever someone joins.",
      },
      {
        key: "channels.manage",
        label: "Create and delete channels",
        description: "Start channels with hand-picked members and delete them for everyone. General always stays.",
      },
      {
        key: "messages.moderate",
        label: "Moderate chat",
        description: "Delete anyone's message in the workspace's channels.",
      },
    ],
  },
  {
    key: "files",
    name: "Files",
    summary: "Storage and documents",
    Icon: FolderOpen,
    abilities: [
      {
        key: "files.viewAll",
        label: "See restricted folders",
        description: "Open every folder and the files in it, including ones they haven't been added to.",
      },
      {
        key: "files.manage",
        label: "Manage everyone's files",
        description: "Move and delete anyone's files, and rename, restrict or delete anyone's folders.",
      },
      {
        key: "documents.viewAll",
        label: "See restricted documents",
        description: "Open every document, including ones shared only with the people assigned.",
      },
      {
        key: "documents.manage",
        label: "Manage everyone's documents",
        description: "Change who can open anyone's document, and delete it.",
      },
    ],
  },
  {
    key: "workspace",
    name: "Workspace",
    summary: "Profile and branding",
    Icon: Building2,
    abilities: [
      {
        key: "workspace.edit",
        label: "Edit workspace details",
        description: "The workspace's name, description, type, color and logo.",
      },
    ],
  },
];

export const ALL_ABILITIES = ABILITY_GROUPS.flatMap((g) => g.abilities.map((a) => a.key));

// Starting points on the Access dialog. Picking one replaces the ticked
// abilities; the admin can fine-tune from there.
export const ACCESS_PRESETS = [
  { key: "member", label: "Member", abilities: [] },
  {
    key: "team-lead",
    label: "Team lead",
    abilities: ["tasks.status", "statuses.manage", "events.manage", "members.manage", "channels.manage"],
  },
  { key: "moderator", label: "Moderator", abilities: ["members.manage", "channels.manage", "messages.moderate"] },
  {
    key: "content-manager",
    label: "Content manager",
    abilities: ["files.viewAll", "files.manage", "documents.viewAll", "documents.manage"],
  },
];

export const ROLE_LABELS = { ADMIN: "Admin", MEMBER: "Member", MANAGER: "Manager" };

// What to call someone in a workspace: the title an admin gave them, or
// their role.
export function memberTitle(member) {
  return member?.title || ROLE_LABELS[member?.role] || "Member";
}

// Whether the signed-in user holds an ability in a workspace. Takes any
// workspace object the API returns (the list or a single workspace); admins
// hold every ability. myPermissions is missing until the server is updated,
// in which case only admins pass, exactly as before abilities existed.
export function can(workspace, ability) {
  if (!workspace) return false;
  if (workspace.myRole === "ADMIN") return true;
  return Array.isArray(workspace.myPermissions) && workspace.myPermissions.includes(ability);
}

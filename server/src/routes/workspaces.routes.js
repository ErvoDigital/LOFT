import { Router } from "express";
import * as workspacesController from "../controllers/workspaces.controller.js";
import * as invitesController from "../controllers/invites.controller.js";
import { requireAuth, requireWorkspaceMember, requirePermission } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", workspacesController.listMyWorkspaces);
router.post("/", workspacesController.createWorkspace);
router.post("/join", workspacesController.joinWorkspace);

router.get("/:workspaceId", requireWorkspaceMember(), workspacesController.getWorkspace);
router.get("/:workspaceId/dashboard", requireWorkspaceMember(), workspacesController.getWorkspaceDashboard);
router.patch(
  "/:workspaceId",
  requireWorkspaceMember(),
  requirePermission("workspace.edit"),
  workspacesController.updateWorkspace
);
router.post("/:workspaceId/leave", requireWorkspaceMember(), workspacesController.leaveWorkspace);

// Inviting people is admin-only, the same as seeing the invite code.
router.post("/:workspaceId/invite-code", requireWorkspaceMember(["ADMIN"]), workspacesController.resetInviteCode);
router.get("/:workspaceId/invites", requireWorkspaceMember(["ADMIN"]), invitesController.listInvites);
router.post("/:workspaceId/invites", requireWorkspaceMember(["ADMIN"]), invitesController.sendInvites);
router.delete("/:workspaceId/invites/:inviteId", requireWorkspaceMember(["ADMIN"]), invitesController.revokeInvite);

// Access (role, title, abilities) is always admin-only; removing someone is
// an ability an admin can hand out.
router.patch(
  "/:workspaceId/members/:memberId",
  requireWorkspaceMember(["ADMIN"]),
  workspacesController.updateMemberAccess
);
router.delete(
  "/:workspaceId/members/:memberId",
  requireWorkspaceMember(),
  requirePermission("members.manage"),
  workspacesController.removeMember
);

export default router;

import { Router } from "express";
import * as workspacesController from "../controllers/workspaces.controller.js";
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

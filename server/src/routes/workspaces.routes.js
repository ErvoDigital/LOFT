import { Router } from "express";
import * as workspacesController from "../controllers/workspaces.controller.js";
import { requireAuth, requireWorkspaceMember } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", workspacesController.listMyWorkspaces);
router.post("/", workspacesController.createWorkspace);
router.post("/join", workspacesController.joinWorkspace);

router.get("/:workspaceId", requireWorkspaceMember(), workspacesController.getWorkspace);
router.patch("/:workspaceId", requireWorkspaceMember(["ADMIN"]), workspacesController.updateWorkspace);
router.post("/:workspaceId/leave", requireWorkspaceMember(), workspacesController.leaveWorkspace);

router.patch(
  "/:workspaceId/members/:memberId",
  requireWorkspaceMember(["ADMIN"]),
  workspacesController.updateMemberRole
);
router.delete(
  "/:workspaceId/members/:memberId",
  requireWorkspaceMember(["ADMIN", "MANAGER"]),
  workspacesController.removeMember
);

export default router;

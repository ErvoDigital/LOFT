import { Router } from "express";
import * as conversationsController from "../controllers/conversations.controller.js";
import { requireAuth, requireWorkspaceMember } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireWorkspaceMember());

router.get("/", conversationsController.listWorkspaceConversations);
router.post("/", conversationsController.createWorkspaceConversation);
router.delete("/:conversationId", conversationsController.deleteWorkspaceConversation);

export default router;

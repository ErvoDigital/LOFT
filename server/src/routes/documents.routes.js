import { Router } from "express";
import * as documentsController from "../controllers/documents.controller.js";
import { requireAuth, requireWorkspaceMember } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireWorkspaceMember());

router.get("/", documentsController.listWorkspaceDocuments);
router.get("/:documentId", documentsController.getWorkspaceDocument);
router.post("/", documentsController.createWorkspaceDocument);
router.patch("/:documentId", documentsController.renameWorkspaceDocument);
router.patch("/:documentId/access", documentsController.updateDocumentAccess);
router.delete("/:documentId", documentsController.deleteWorkspaceDocument);

export default router;

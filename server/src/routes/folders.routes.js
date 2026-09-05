import { Router } from "express";
import * as foldersController from "../controllers/folders.controller.js";
import { requireAuth, requireWorkspaceMember } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireWorkspaceMember());

router.get("/", foldersController.listFolders);
router.post("/", foldersController.createFolder);
router.patch("/:folderId", foldersController.updateFolder);
router.delete("/:folderId", foldersController.deleteFolder);

export default router;

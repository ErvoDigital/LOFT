import { Router } from "express";
import * as tasksController from "../controllers/tasks.controller.js";
import * as assetsController from "../controllers/assets.controller.js";
import { requireAuth, requireWorkspaceMember } from "../middleware/auth.js";
import { requireStorageConfigured, singleFileUpload } from "../middleware/storageUpload.js";

const router = Router();
router.use(requireAuth);

router.get("/", tasksController.listMyTasks);

const workspaceRouter = Router({ mergeParams: true });
workspaceRouter.use(requireWorkspaceMember());
workspaceRouter.get("/", tasksController.listWorkspaceTasks);
workspaceRouter.post("/", tasksController.createTask);
workspaceRouter.patch("/:taskId", tasksController.updateTask);
workspaceRouter.delete("/:taskId", tasksController.deleteTask);
workspaceRouter.get("/:taskId/attachments", assetsController.listTaskAttachments);
workspaceRouter.post("/:taskId/attachments", requireStorageConfigured, singleFileUpload, assetsController.uploadTaskAttachment);
workspaceRouter.delete("/:taskId/attachments/:assetId", assetsController.deleteAsset);

export default router;
export { workspaceRouter as workspaceTasksRouter };

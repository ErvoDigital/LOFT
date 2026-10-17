import { Router } from "express";
import * as tasksController from "../controllers/tasks.controller.js";
import * as assetsController from "../controllers/assets.controller.js";
import * as collaboration from "../controllers/taskCollaboration.controller.js";
import { trashAsset } from "../controllers/assetRecovery.controller.js";
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
workspaceRouter.get("/:taskId/details", collaboration.getDetails);
workspaceRouter.post("/:taskId/comments", collaboration.addComment);
workspaceRouter.post("/:taskId/dependencies", collaboration.setDependency);
workspaceRouter.delete("/:taskId/dependencies/:dependsOnId", collaboration.removeDependency);
workspaceRouter.delete("/:taskId", tasksController.deleteTask);
workspaceRouter.get("/:taskId/attachments", assetsController.listTaskAttachments);
workspaceRouter.post("/:taskId/attachments", requireStorageConfigured, singleFileUpload, assetsController.uploadTaskAttachment);
workspaceRouter.delete("/:taskId/attachments/:assetId", trashAsset);

export default router;
export { workspaceRouter as workspaceTasksRouter };

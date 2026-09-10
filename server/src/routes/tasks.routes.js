import { Router } from "express";
import multer from "multer";
import * as tasksController from "../controllers/tasks.controller.js";
import * as assetsController from "../controllers/assets.controller.js";
import { requireAuth, requireWorkspaceMember } from "../middleware/auth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB, generous for video
});

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
workspaceRouter.post("/:taskId/attachments", upload.single("file"), assetsController.uploadTaskAttachment);
workspaceRouter.delete("/:taskId/attachments/:assetId", assetsController.deleteAsset);

export default router;
export { workspaceRouter as workspaceTasksRouter };

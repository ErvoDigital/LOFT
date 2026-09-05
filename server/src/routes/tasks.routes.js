import { Router } from "express";
import * as tasksController from "../controllers/tasks.controller.js";
import { requireAuth, requireWorkspaceMember } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", tasksController.listMyTasks);

const workspaceRouter = Router({ mergeParams: true });
workspaceRouter.use(requireWorkspaceMember());
workspaceRouter.get("/", tasksController.listWorkspaceTasks);
workspaceRouter.post("/", tasksController.createTask);
workspaceRouter.patch("/:taskId", tasksController.updateTask);
workspaceRouter.delete("/:taskId", tasksController.deleteTask);

export default router;
export { workspaceRouter as workspaceTasksRouter };

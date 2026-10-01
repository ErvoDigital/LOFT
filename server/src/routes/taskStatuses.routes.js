import { Router } from "express";
import * as controller from "../controllers/taskStatuses.controller.js";
import { requireAuth, requireWorkspaceMember, requirePermission } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get("/", requireWorkspaceMember(), controller.listTaskStatuses);
router.post("/", requireWorkspaceMember(), requirePermission("statuses.manage"), controller.createTaskStatus);
router.patch("/:statusId", requireWorkspaceMember(), requirePermission("statuses.manage"), controller.updateTaskStatus);
router.delete("/:statusId", requireWorkspaceMember(), requirePermission("statuses.manage"), controller.deleteTaskStatus);

export default router;

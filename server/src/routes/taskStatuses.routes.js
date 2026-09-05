import { Router } from "express";
import * as controller from "../controllers/taskStatuses.controller.js";
import { requireAuth, requireWorkspaceMember } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get("/", requireWorkspaceMember(), controller.listTaskStatuses);
router.post("/", requireWorkspaceMember(["ADMIN"]), controller.createTaskStatus);
router.patch("/:statusId", requireWorkspaceMember(["ADMIN"]), controller.updateTaskStatus);
router.delete("/:statusId", requireWorkspaceMember(["ADMIN"]), controller.deleteTaskStatus);

export default router;

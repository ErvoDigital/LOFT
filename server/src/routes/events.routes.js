import { Router } from "express";
import * as eventsController from "../controllers/events.controller.js";
import { requireAuth, requireWorkspaceMember } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", eventsController.listMyEvents);

const workspaceRouter = Router({ mergeParams: true });
workspaceRouter.use(requireWorkspaceMember());
workspaceRouter.get("/", eventsController.listWorkspaceEvents);
workspaceRouter.post("/", eventsController.createEvent);
workspaceRouter.patch("/:eventId", eventsController.updateEvent);
workspaceRouter.delete("/:eventId", eventsController.cancelEvent);

export default router;
export { workspaceRouter as workspaceEventsRouter };

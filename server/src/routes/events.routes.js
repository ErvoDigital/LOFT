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
// Changing a shared calendar is admin-only — any member can still add an
// event, but only an admin can edit or cancel one once it's on there. The
// calendar's details card hides both actions for everyone else; this is what
// actually enforces it.
workspaceRouter.patch("/:eventId", requireWorkspaceMember(["ADMIN"]), eventsController.updateEvent);
workspaceRouter.delete("/:eventId", requireWorkspaceMember(["ADMIN"]), eventsController.cancelEvent);

export default router;
export { workspaceRouter as workspaceEventsRouter };

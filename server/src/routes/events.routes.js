import { Router } from "express";
import * as eventsController from "../controllers/events.controller.js";
import * as eventDraftsController from "../controllers/eventDrafts.controller.js";
import { requireAuth, requireWorkspaceMember, requirePermission } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", eventsController.listMyEvents);

const workspaceRouter = Router({ mergeParams: true });
workspaceRouter.use(requireWorkspaceMember());
workspaceRouter.get("/", eventsController.listWorkspaceEvents);
workspaceRouter.post("/", eventsController.createEvent);
workspaceRouter.get("/drafts", eventDraftsController.listEventDrafts);
workspaceRouter.post("/drafts", eventDraftsController.createEventDraft);
workspaceRouter.patch("/drafts/:draftId", eventDraftsController.updateEventDraft);
workspaceRouter.delete("/drafts/:draftId", eventDraftsController.deleteEventDraft);
workspaceRouter.post("/drafts/:draftId/schedule", eventDraftsController.scheduleEventDraft);
// Changing a shared calendar takes the events.manage ability (admins, plus
// anyone an admin granted it to) — any member can still add an event, but
// only those people can edit or cancel one once it's on there. The calendar's
// details card hides both actions for everyone else; this is what actually
// enforces it.
workspaceRouter.patch("/:eventId", requirePermission("events.manage"), eventsController.updateEvent);
workspaceRouter.delete("/:eventId", requirePermission("events.manage"), eventsController.cancelEvent);

export default router;
export { workspaceRouter as workspaceEventsRouter };

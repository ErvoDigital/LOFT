import { Router } from "express";
import * as notificationsController from "../controllers/notifications.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", notificationsController.listNotifications);
router.get("/preferences", notificationsController.getPreferences);
router.patch("/preferences", notificationsController.savePreferences);
router.post("/:notificationId/snooze", notificationsController.snooze);
router.post("/:notificationId/read", notificationsController.markRead);
router.post("/read-all", notificationsController.markAllRead);

export default router;

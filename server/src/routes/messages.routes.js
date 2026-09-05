import { Router } from "express";
import * as messagesController from "../controllers/messages.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/conversations", messagesController.listConversations);
router.get("/conversations/:conversationId/messages", messagesController.getMessages);
router.post("/conversations/:conversationId/messages", messagesController.sendMessageRest);
router.post("/dm/:userId", messagesController.startDirectMessage);

export default router;

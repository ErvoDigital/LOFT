import { Router } from "express";
import * as invitesController from "../controllers/invites.controller.js";
import { requireAuth } from "../middleware/auth.js";

// The emailed invite link. Reading it is public, so the page can show who sent
// it before the person signs in; accepting it needs their account.
const router = Router();

router.get("/:token", invitesController.getInvite);
router.post("/:token/accept", requireAuth, invitesController.acceptInvite);

export default router;

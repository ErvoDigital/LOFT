import { Router } from "express";
import * as planController from "../controllers/plan.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.get("/", planController.getPlan);
router.patch("/preferences", planController.savePreferences);
router.post("/recommendations", planController.getRecommendations);

export default router;

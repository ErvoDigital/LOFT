import { Router } from "express";
import * as planController from "../controllers/plan.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.get("/", planController.getPlan);

export default router;

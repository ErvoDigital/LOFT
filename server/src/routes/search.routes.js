import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { globalSearch } from "../controllers/search.controller.js";

const router = Router();

router.use(requireAuth);
router.get("/", globalSearch);

export default router;

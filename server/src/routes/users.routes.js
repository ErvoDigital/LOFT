import { Router } from "express";
import * as usersController from "../controllers/users.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.patch("/me", usersController.updateProfile);
router.post("/me/change-password", usersController.changePassword);
router.get("/search", usersController.searchUsers);

export default router;

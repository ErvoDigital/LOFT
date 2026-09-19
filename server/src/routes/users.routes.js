import { Router } from "express";
import * as usersController from "../controllers/users.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.patch("/me", usersController.updateProfile);
router.post("/me/password-change/send-code", usersController.sendPasswordChangeCode);
router.post("/me/password-change/verify-code", usersController.verifyPasswordChangeCode);
router.post("/me/change-password", usersController.changePassword);
router.post("/me/link-google", usersController.linkGoogle);
router.post("/me/unlink-google", usersController.unlinkGoogle);
router.get("/search", usersController.searchUsers);
router.get("/:userId/profile", usersController.getUserProfile);

export default router;

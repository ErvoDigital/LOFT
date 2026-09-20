import { Router } from "express";
import * as usersController from "../controllers/users.controller.js";
import * as followsController from "../controllers/follows.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.patch("/me", usersController.updateProfile);
router.post("/me/password-change/send-code", usersController.sendPasswordChangeCode);
router.post("/me/password-change/verify-code", usersController.verifyPasswordChangeCode);
router.post("/me/change-password", usersController.changePassword);
router.post("/me/link-google", usersController.linkGoogle);
router.post("/me/unlink-google", usersController.unlinkGoogle);
router.get("/me/follows", followsController.listMyFollows);
router.get("/search", usersController.searchUsers);
router.get("/:userId/profile", usersController.getUserProfile);
router.post("/:userId/follow", followsController.requestFollow);
router.post("/:userId/follow/accept", followsController.acceptFollow);
// Declining a request, cancelling one you sent, and unfollowing all land here.
router.delete("/:userId/follow", followsController.removeFollow);

export default router;

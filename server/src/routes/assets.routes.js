import { Router } from "express";
import multer from "multer";
import * as assetsController from "../controllers/assets.controller.js";
import { requireAuth, requireWorkspaceMember } from "../middleware/auth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB, generous for video
});

const router = Router({ mergeParams: true });
router.use(requireAuth, requireWorkspaceMember());

router.get("/", assetsController.listAssets);
router.post("/", upload.single("file"), assetsController.uploadAsset);
router.post("/:assetId/versions", upload.single("file"), assetsController.uploadVersion);
router.post("/:assetId/merge", assetsController.mergeAssets);
router.patch("/:assetId/folder", assetsController.moveAsset);
router.get("/:assetId/versions/:versionId/download", assetsController.downloadVersion);
router.delete("/:assetId", assetsController.deleteAsset);

export default router;

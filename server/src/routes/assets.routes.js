import { Router } from "express";
import * as assetsController from "../controllers/assets.controller.js";
import { requireAuth, requireWorkspaceMember } from "../middleware/auth.js";
import { requireStorageConfigured, singleFileUpload } from "../middleware/storageUpload.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireWorkspaceMember());

router.get("/", assetsController.listAssets);
router.post("/", requireStorageConfigured, singleFileUpload, assetsController.uploadAsset);
router.post("/chat-attachment", requireStorageConfigured, singleFileUpload, assetsController.uploadChatAttachment);
router.post("/:assetId/versions", requireStorageConfigured, singleFileUpload, assetsController.uploadVersion);
router.post("/:assetId/merge", assetsController.mergeAssets);
router.patch("/:assetId/folder", assetsController.moveAsset);
router.get("/:assetId/versions/:versionId/download", assetsController.downloadVersion);
router.delete("/:assetId", assetsController.deleteAsset);

export default router;

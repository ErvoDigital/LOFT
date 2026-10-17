import { Router } from "express";
import * as assetsController from "../controllers/assets.controller.js";
import * as recovery from "../controllers/assetRecovery.controller.js";
import * as resumable from "../controllers/resumableUploads.controller.js";
import { requireAuth, requireWorkspaceMember } from "../middleware/auth.js";
import { requireStorageConfigured, singleFileUpload } from "../middleware/storageUpload.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireWorkspaceMember());

router.get("/", assetsController.listAssets);
router.get("/trash", recovery.listTrash);
router.post("/uploads", requireStorageConfigured, resumable.begin);
router.get("/uploads/:uploadId", requireStorageConfigured, resumable.status);
router.get("/uploads/:uploadId/parts/:partNumber", requireStorageConfigured, resumable.partUrl);
router.post("/uploads/:uploadId/complete", requireStorageConfigured, resumable.complete);
router.delete("/uploads/:uploadId", requireStorageConfigured, resumable.cancel);
router.post("/:assetId/restore", recovery.restoreAsset);
router.post("/:assetId/versions/:versionId/restore", recovery.restoreVersion);
router.delete("/:assetId/permanent", recovery.purgeAsset);
router.post("/", requireStorageConfigured, singleFileUpload, assetsController.uploadAsset);
router.post("/chat-attachment", requireStorageConfigured, singleFileUpload, assetsController.uploadChatAttachment);
router.post("/:assetId/versions", requireStorageConfigured, singleFileUpload, assetsController.uploadVersion);
router.post("/:assetId/merge", assetsController.mergeAssets);
router.patch("/:assetId/folder", assetsController.moveAsset);
router.get("/:assetId/versions/:versionId/download", assetsController.downloadVersion);
router.delete("/:assetId", recovery.trashAsset);

export default router;

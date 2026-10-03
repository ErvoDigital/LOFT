import { deleteObject, uploadObject } from "../utils/uploads.js";
import { ApiError } from "../utils/ApiError.js";
import { logStructuredError, summarizeError } from "../utils/logger.js";

export async function uploadWithCompensation({
  workspaceId,
  storedName,
  buffer,
  mimeType,
  operationType,
  persist,
}) {
  await uploadObject(workspaceId, storedName, buffer, mimeType);

  try {
    return await persist();
  } catch (databaseError) {
    try {
      await deleteObject(workspaceId, storedName);
    } catch (cleanupError) {
      logStructuredError("storage.upload_compensation_failed", {
        workspaceId,
        objectName: storedName,
        operationType,
        databaseError: summarizeError(databaseError),
        cleanupError: summarizeError(cleanupError),
      });
      throw new ApiError(500, "File upload could not be completed");
    }
    throw databaseError;
  }
}

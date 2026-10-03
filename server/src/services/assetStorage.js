import { assertStorageConfigured, deleteObject } from "../utils/uploads.js";

export async function deleteStoredVersions(workspaceId, versions) {
  const storedNames = [...new Set(versions.map((version) => version.storedName).filter(Boolean))];
  if (storedNames.length === 0) return;
  assertStorageConfigured();
  // Keep deletion sequential: after the first real S3 failure no further
  // object operations or database mutations are attempted. Retrying is safe
  // because S3 NotFound is treated as a successful deletion.
  for (const storedName of storedNames) {
    await deleteObject(workspaceId, storedName);
  }
}

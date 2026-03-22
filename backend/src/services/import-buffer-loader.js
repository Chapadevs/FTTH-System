import { isLocalImportPath, readLocalImportBuffer } from "./local-import-storage.js";
import { storage } from "./gcs.js";

/**
 * Load import file buffer by filePath.
 * - Local paths (local-imports/...) are read from disk.
 * - Other paths are downloaded from the configured GCS import bucket.
 */
export async function downloadImportBuffer(filePath) {
  if (isLocalImportPath(filePath)) {
    return readLocalImportBuffer(filePath);
  }
  const bucket = storage.bucket(process.env.GCS_BUCKET_IMPORTS);
  const file = bucket.file(filePath);
  const [buffer] = await file.download();
  return buffer;
}

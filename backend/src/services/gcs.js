import { Storage } from "@google-cloud/storage";

const storage = new Storage({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

export async function getSignedUploadUrl(fileName, contentType, bucketName) {
  const bucket = storage.bucket(bucketName || process.env.GCS_BUCKET_IMPORTS);
  const file = bucket.file(`imports/${Date.now()}-${fileName}`);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType: contentType || "application/zip",
  });
  return { url, filePath: file.name };
}

export async function getSignedDownloadUrl(filePath, bucketName) {
  const bucket = storage.bucket(bucketName || process.env.GCS_BUCKET_IMPORTS);
  const file = bucket.file(filePath);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 60 * 60 * 1000,
  });
  return url;
}

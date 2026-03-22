import { Storage } from "@google-cloud/storage";

function parseServiceAccountKeyFromEnv() {
  const raw = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON || process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!raw?.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("GCP_SERVICE_ACCOUNT_KEY_JSON (or GCP_SERVICE_ACCOUNT_KEY) must be valid JSON");
  }
}

const saCredentials = parseServiceAccountKeyFromEnv();

/** Shared client; downloads work with user ADC, but signed URLs require a service account key. */
export const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID || saCredentials?.project_id || undefined,
  ...(saCredentials ? { credentials: saCredentials } : {}),
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

function signingCredentialsHint() {
  return new Error(
    "GCS signed URLs require a service account JSON key (not user credentials from gcloud auth application-default login). " +
      "Set GOOGLE_APPLICATION_CREDENTIALS to the path of a key file, or set GCP_SERVICE_ACCOUNT_KEY_JSON to the raw JSON, " +
      "for an account with access to the import bucket."
  );
}

export async function getSignedUploadUrl(fileName, contentType, bucketName) {
  const bucket = storage.bucket(bucketName || process.env.GCS_BUCKET_IMPORTS);
  const file = bucket.file(`imports/${Date.now()}-${fileName}`);
  try {
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType: contentType || "application/zip",
    });
    return { url, filePath: file.name };
  } catch (err) {
    if (err?.message?.includes("client_email")) throw signingCredentialsHint();
    throw err;
  }
}

export async function getSignedDownloadUrl(filePath, bucketName) {
  const bucket = storage.bucket(bucketName || process.env.GCS_BUCKET_IMPORTS);
  const file = bucket.file(filePath);
  try {
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });
    return url;
  } catch (err) {
    if (err?.message?.includes("client_email")) throw signingCredentialsHint();
    throw err;
  }
}

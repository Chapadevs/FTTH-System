import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const LOCAL_DIR = path.resolve(process.cwd(), ".local-imports");
const LOCAL_PREFIX = "local-imports/";

/**
 * Local disk imports (no GCS signed URLs). Default on when NODE_ENV is not production;
 * override with IMPORT_LOCAL_STORAGE=true|false.
 */
export function useLocalImportStorage() {
  const v = process.env.IMPORT_LOCAL_STORAGE;
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export async function ensureLocalImportDir() {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
}

export function isLocalImportPath(filePath) {
  return typeof filePath === "string" && filePath.startsWith(LOCAL_PREFIX);
}

function safeBasename(name) {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base || "import.bin";
}

export async function saveLocalImportBuffer(buffer, originalName) {
  await ensureLocalImportDir();
  const id = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const name = `${id}-${safeBasename(originalName)}`;
  const full = path.join(LOCAL_DIR, name);
  await fs.writeFile(full, buffer);
  return `${LOCAL_PREFIX}${name}`;
}

function resolveLocalImportPath(filePath) {
  if (!isLocalImportPath(filePath)) throw new Error("Not a local import path");
  const rel = filePath.slice(LOCAL_PREFIX.length);
  if (!rel || rel.includes("..") || path.isAbsolute(rel) || rel.includes("/") || rel.includes("\\")) {
    throw new Error("Invalid local import path");
  }
  const full = path.join(LOCAL_DIR, rel);
  const resolved = path.resolve(full);
  const baseResolved = path.resolve(LOCAL_DIR);
  if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
    throw new Error("Invalid local import path");
  }
  return resolved;
}

export async function readLocalImportBuffer(filePath) {
  return fs.readFile(resolveLocalImportPath(filePath));
}

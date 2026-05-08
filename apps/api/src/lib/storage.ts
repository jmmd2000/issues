import fs from "node:fs";
import path from "node:path";

/** Matches `<sha256>.<2-5 char ext>`. Used as a path-traversal guard on the public route. */
export const STORAGE_KEY_RE = /^[a-f0-9]{64}\.[a-z0-9]{2,5}$/;

let resolvedDir: string | null = null;

/**
 * Returns the absolute path to the uploads directory, creating it if missing.
 * Resolves `process.env.UPLOADS_DIR` (default `./data/uploads`) once at first
 * call. Tests can switch directories per-run by setting UPLOADS_DIR before
 * importing this module - call `resetUploadsDir()` to clear the cache between
 * cases.
 */
export function getUploadsDir(): string {
  if (resolvedDir) return resolvedDir;
  const raw = process.env.UPLOADS_DIR ?? "./data/uploads";
  const abs = path.resolve(raw);
  fs.mkdirSync(abs, { recursive: true });
  resolvedDir = abs;
  return abs;
}

export function resetUploadsDir(): void {
  resolvedDir = null;
}

function fullPath(storageKey: string): string {
  if (!STORAGE_KEY_RE.test(storageKey)) {
    throw new Error(`Invalid storage key: ${storageKey}`);
  }
  return path.join(getUploadsDir(), storageKey);
}

export async function writeAttachment(storageKey: string, bytes: Buffer): Promise<void> {
  await fs.promises.writeFile(fullPath(storageKey), bytes);
}

export function attachmentExists(storageKey: string): boolean {
  try {
    fs.statSync(fullPath(storageKey));
    return true;
  } catch {
    return false;
  }
}

export function attachmentSize(storageKey: string): number | null {
  try {
    return fs.statSync(fullPath(storageKey)).size;
  } catch {
    return null;
  }
}

export function readAttachmentStream(storageKey: string): fs.ReadStream {
  return fs.createReadStream(fullPath(storageKey));
}

export async function deleteAttachment(storageKey: string): Promise<void> {
  try {
    await fs.promises.unlink(fullPath(storageKey));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

export async function listStoredKeys(): Promise<string[]> {
  const dir = getUploadsDir();
  const entries = await fs.promises.readdir(dir);
  return entries.filter((name) => STORAGE_KEY_RE.test(name));
}

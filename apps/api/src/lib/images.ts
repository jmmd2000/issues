import crypto from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { HTTPException } from "hono/http-exception";

const MAX_IMAGE_DIMENSION = { width: 1920, height: 1080 } as const;
const AVATAR_DIMENSION = 512;
const WEBP_QUALITY = 80;
// Upper bound on decoded pixels to defuse decompression bombs. 32 MP covers
// any legitimate phone/camera image; sharp's default of ~268 MP is too lax.
const MAX_INPUT_PIXELS = 32_000_000;

/**
 * Allow-list of file extensions for non-image attachments. Mapped to the MIME
 * we serve back (browsers honour Content-Type from the route, not the on-disk
 * filename, so this is what `/uploads/:key` will respond with).
 */
const FILE_EXTENSION_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".log": "text/plain",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".tgz": "application/gzip",
  ".7z": "application/x-7z-compressed",
  ".diff": "text/plain",
  ".patch": "text/plain",
  ".sql": "application/sql",
};

export type ProcessedImage = {
  bytes: Buffer;
  contentHash: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: "image/webp";
  extension: ".webp";
};

export type ProcessedFile = {
  bytes: Buffer;
  contentHash: string;
  sizeBytes: number;
  mimeType: string;
  extension: string;
};

/**
 * Resizes an image to fit within 1920x1080 (no upscale), normalises EXIF
 * orientation, strips metadata, encodes as WebP, and returns the bytes plus
 * a sha256 of the output bytes. Hashing the output (not the input) means
 * two visually-identical screenshots dedup even if their original PNG bytes
 * differ slightly.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ ...MAX_IMAGE_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    bytes: data,
    contentHash: sha256(data),
    width: info.width,
    height: info.height,
    sizeBytes: data.length,
    mimeType: "image/webp",
    extension: ".webp",
  };
}

/**
 * Resizes an image to a square 512x512 avatar via centre-cropped cover, strips
 * metadata, encodes as WebP. Square fit:cover means the caller can hand in any
 * aspect ratio and still get a clean avatar.
 */
export async function processAvatar(input: Buffer): Promise<ProcessedImage> {
  const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width: AVATAR_DIMENSION, height: AVATAR_DIMENSION, fit: "cover", position: "centre" })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    bytes: data,
    contentHash: sha256(data),
    width: info.width,
    height: info.height,
    sizeBytes: data.length,
    mimeType: "image/webp",
    extension: ".webp",
  };
}

/**
 * Stores a non-image file as-is after validating its extension. Hashes input
 * bytes for dedup. Throws 415 if the extension is not on the allow-list.
 */
export function processFile(input: Buffer, originalFilename: string, _mimeType: string): ProcessedFile {
  const ext = path.extname(originalFilename).toLowerCase();
  const mimeType = FILE_EXTENSION_MIME[ext];
  if (!mimeType) {
    throw new HTTPException(415, {
      message: `Unsupported file type: ${ext || "(no extension)"}. Allowed: ${Object.keys(FILE_EXTENSION_MIME).join(", ")}.`,
    });
  }

  return {
    bytes: input,
    contentHash: sha256(input),
    sizeBytes: input.length,
    mimeType,
    extension: ext,
  };
}

function sha256(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

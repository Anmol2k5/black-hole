/**
 * File storage module.
 * Saves uploaded files to the workspace raw/ directory and creates DB records.
 *
 * Uploaded files are NEVER stored under public/. The storage filename is the
 * source ID plus a sanitized extension; the original filename is preserved
 * only as metadata.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { v4 as uuid } from "uuid";
import { getDb } from "../db/client";
import { getRawDirectory } from "../paths";
import { sanitizeExtension } from "../uploads/policy";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  calls: ["call", "transcript", "conversation", "interview", "recording", "vtt", "srt"],
  support: ["support", "ticket", "issue", "bug", "complaint", "help"],
  sales: ["sales", "deal", "proposal", "pitch", "prospect", "lead", "pipeline"],
  meetings: ["meeting", "standup", "retro", "review", "sync", "minutes"],
  docs: ["doc", "guide", "spec", "prd", "rfc", "readme", "policy"],
};

export function classifyCategory(filename: string): string {
  const lower = filename.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return "docs";
}

export function getFileType(filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace(".", "");
  return ["txt", "md", "pdf", "csv", "docx", "json", "vtt", "srt"].includes(ext) ? ext : "txt";
}

export function checksumBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/** Find an existing, non-failed source with the same checksum. */
export function findDuplicateSource(checksum: string): { id: string; original_name: string } | undefined {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, original_name FROM sources WHERE checksum_sha256 = ? AND status != 'failed' ORDER BY uploaded_at DESC LIMIT 1`,
    )
    .get(checksum) as { id: string; original_name: string } | undefined;
}

/**
 * Save an uploaded file to disk and create a source record.
 * Returns the new source ID.
 */
export async function saveUploadedFile(
  fileBuffer: Buffer,
  originalName: string,
): Promise<string> {
  const id = uuid();
  const category = classifyCategory(originalName);
  const fileType = getFileType(originalName);
  const extension = sanitizeExtension(originalName);
  const checksum = checksumBuffer(fileBuffer);

  // Ensure directory exists under the workspace raw root.
  const dir = path.join(getRawDirectory(), category);
  fs.mkdirSync(dir, { recursive: true });

  // Storage filename is the source ID + sanitized extension (never the original name).
  const storedName = `${id}${extension}`;
  const filePath = path.join(dir, storedName);
  fs.writeFileSync(filePath, fileBuffer);

  const db = getDb();
  db.prepare(
    `INSERT INTO sources (id, filename, original_name, file_path, file_type, category, file_size, checksum_sha256, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  ).run(id, storedName, originalName, filePath, fileType, category, fileBuffer.length, checksum);

  return id;
}

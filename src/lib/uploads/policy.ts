/**
 * Shared upload policy. All file ingestion is validated against these rules
 * on the server before any processing happens.
 */

import path from "node:path";

export const ALLOWED_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".pdf",
  ".docx",
  ".csv",
  ".json",
  ".vtt",
  ".srt",
]);

export const ALLOWED_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "application/json",
  "text/vtt",
  // SRT often arrives with no usable MIME type; extension covers it.
]);

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 10;

export interface FileValidationResult {
  ok: boolean;
  status: number;
  error?: string;
  extension?: string;
}

/**
 * Validate an uploaded File object. Returns an HTTP status code to use when
 * the file is rejected.
 */
export function validateUploadFile(file: File): FileValidationResult {
  if (!file || file.size === 0) {
    return { ok: false, status: 400, error: "File is empty." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `File exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`,
    };
  }

  const originalName = file.name || "";
  const extension = path.extname(originalName).toLowerCase();

  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      status: 415,
      error: `Unsupported file type "${extension || "unknown"}".`,
    };
  }

  // Best-effort MIME check; some clients send empty/odd MIME types, so the
  // extension is the authoritative gate.
  if (file.type && file.type !== "application/octet-stream") {
    const baseMime = file.type.split(";")[0].trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(baseMime)) {
      // Allow extension-based pass when MIME is unrecognized but extension is.
      // Only hard-reject clearly wrong binary types we never accept.
      const clearlyWrong = ["image/", "video/", "audio/", "application/zip", "application/x-msdownload"];
      if (clearlyWrong.some((p) => baseMime.startsWith(p))) {
        return {
          ok: false,
          status: 415,
          error: `Unsupported content type "${file.type}".`,
        };
      }
    }
  }

  return { ok: true, status: 200, extension };
}

export function sanitizeExtension(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) ? ext : ".txt";
}

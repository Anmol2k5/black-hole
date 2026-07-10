import { describe, it, expect } from "vitest";
import {
  validateUploadFile,
  sanitizeExtension,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_REQUEST,
} from "@/lib/uploads/policy";

function makeFile(name: string, size: number, type = ""): File {
  return new File(["x".repeat(size)], name, type ? { type } : undefined);
}

describe("validateUploadFile", () => {
  it("accepts a small .txt file", () => {
    const res = validateUploadFile(makeFile("notes.txt", 100));
    expect(res.ok).toBe(true);
    expect(res.extension).toBe(".txt");
  });

  it("rejects empty files with 400", () => {
    const res = validateUploadFile(makeFile("empty.txt", 0));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  it("rejects oversized files with 413", () => {
    const res = validateUploadFile(makeFile("big.txt", MAX_FILE_SIZE_BYTES + 1));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(413);
  });

  it("returns 415 for unsupported extensions", () => {
    const res = validateUploadFile(makeFile("malware.exe", 100));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(415);
  });

  it("rejects clearly wrong binary MIME types", () => {
    const res = validateUploadFile(makeFile("picture.png", 100, "image/png"));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(415);
  });

  it("allows allowed extensions even with unfamiliar MIME", () => {
    const res = validateUploadFile(makeFile("call.srt", 100, "application/octet-stream"));
    expect(res.ok).toBe(true);
  });
});

describe("sanitizeExtension", () => {
  it("keeps allowed extensions", () => {
    expect(sanitizeExtension("call.vtt")).toBe(".vtt");
  });
  it("falls back to .txt for unknown extensions", () => {
    expect(sanitizeExtension("data.unknown")).toBe(".txt");
  });
});

describe("policy constants", () => {
  it("exposes sensible limits", () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_FILES_PER_REQUEST).toBe(10);
    expect(ALLOWED_EXTENSIONS.has(".pdf")).toBe(true);
  });
});

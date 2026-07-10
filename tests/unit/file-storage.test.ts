import { describe, it, expect } from "vitest";
import {
  checksumBuffer,
  classifyCategory,
  getFileType,
} from "@/lib/ingestion/file-storage";

describe("checksumBuffer", () => {
  it("is deterministic for identical input", () => {
    const a = checksumBuffer(Buffer.from("same content"));
    const b = checksumBuffer(Buffer.from("same content"));
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("differs for different input", () => {
    const a = checksumBuffer(Buffer.from("one"));
    const b = checksumBuffer(Buffer.from("two"));
    expect(a).not.toBe(b);
  });
});

describe("classifyCategory", () => {
  it("classifies call transcripts", () => {
    expect(classifyCategory("acme-call-transcript.txt")).toBe("calls");
  });
  it("classifies support tickets", () => {
    expect(classifyCategory("support-ticket-bug.txt")).toBe("support");
  });
  it("classifies sales notes", () => {
    expect(classifyCategory("sales-deal-proposal.txt")).toBe("sales");
  });
  it("defaults to docs", () => {
    expect(classifyCategory("random-thing.txt")).toBe("docs");
  });
});

describe("getFileType", () => {
  it("maps extensions", () => {
    expect(getFileType("a.pdf")).toBe("pdf");
    expect(getFileType("b.csv")).toBe("csv");
    expect(getFileType("c.unknown")).toBe("txt");
  });
});

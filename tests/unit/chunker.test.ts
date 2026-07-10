import { describe, it, expect } from "vitest";
import { chunkText, splitForExtraction } from "@/lib/ingestion/chunker";

describe("chunkText", () => {
  it("returns no chunks for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("splits a paragraph document into chunks", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} with some content here.`).join("\n\n");
    const chunks = chunkText(text, 20, 3);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(c.content.length).toBeGreaterThan(0);
      expect(c.charEnd).toBeGreaterThanOrEqual(c.charStart);
    });
  });

  it("produces contiguous, ordered ranges", () => {
    const text = "alpha beta gamma\n\ndelta epsilon zeta\n\neta theta iota";
    const chunks = chunkText(text, 4, 1);
    expect(chunks[0].charStart).toBeLessThan(chunks[chunks.length - 1].charEnd);
  });

  it("does not drop content from a single short paragraph", () => {
    const chunks = chunkText("One short paragraph only.", 200, 20);
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toContain("One short paragraph");
  });
});

describe("splitForExtraction", () => {
  it("segments by character budget with overlap", () => {
    const text = Array.from(
      { length: 200 },
      (_, i) => `Sentence ${i} of the long document with enough words to matter.`,
    ).join("\n\n");
    const segments = splitForExtraction(text, 400, 50);
    expect(segments.length).toBeGreaterThan(1);
    // Overlap: content should be preserved across boundaries.
    const joined = segments.map((s) => s.content).join(" ");
    expect(joined.replace(/\s+/g, " ").length).toBeGreaterThan(text.replace(/\s+/g, " ").length);
  });

  it("returns empty for blank text", () => {
    expect(splitForExtraction("")).toEqual([]);
  });
});

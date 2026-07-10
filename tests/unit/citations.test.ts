import { describe, it, expect } from "vitest";
import {
  validateEvidenceIds,
  measureCoverage,
} from "@/lib/citations/validator";
import { buildEvidenceRegistry, snippetFor } from "@/lib/citations/evidence-registry";
import type { RetrievedChunk } from "@/lib/citations/evidence-registry";

function markerMap(): Map<string, { sourceId: string; chunkId: string | null; sourceTitle: string; sourceDate: string; content: string }> {
  const chunks: RetrievedChunk[] = [
    { chunkId: "c1", sourceId: "s1", content: "Onboarding took an hour.", score: 1 },
    { chunkId: "c2", sourceId: "s2", content: "Pricing feels expensive.", score: 1 },
  ];
  const meta = new Map([
    ["s1", { title: "Acme call", date: "2026-06-15" }],
    ["s2", { title: "Beta call", date: "2026-06-18" }],
  ]);
  const registry = buildEvidenceRegistry(chunks, meta);
  return registry.byId;
}

describe("validateEvidenceIds", () => {
  it("accepts only known evidence markers", () => {
    const byId = markerMap();
    const { valid, invalid } = validateEvidenceIds(byId, ["E1", "E3", "E2"]);
    expect(valid.map((v) => v.sourceId)).toEqual(["s1", "s2"]);
    expect(invalid).toEqual(["E3"]);
  });

  it("rejects all unknown markers", () => {
    const byId = markerMap();
    const { valid, invalid } = validateEvidenceIds(byId, ["E9", "E10"]);
    expect(valid).toEqual([]);
    expect(invalid).toEqual(["E9", "E10"]);
  });

  it("populates source and chunk ids from storage, never trusting the model", () => {
    const byId = markerMap();
    const { valid } = validateEvidenceIds(byId, ["E1"]);
    expect(valid[0].sourceId).toBe("s1");
    expect(valid[0].chunkId).toBe("c1");
    expect(valid[0].sourceTitle).toBe("Acme call");
  });
});

describe("measureCoverage", () => {
  it("counts cited sentences", () => {
    const answer = "Onboarding is slow [E1]. Pricing is high [E2]. Overall acceptable.";
    const cov = measureCoverage(answer, 0);
    expect(cov.totalSentences).toBe(3);
    expect(cov.citedSentences).toBe(2);
    expect(cov.coverage).toBeCloseTo(2 / 3);
  });

  it("records invalid citation count", () => {
    const cov = measureCoverage("Plain answer.", 2);
    expect(cov.invalidCount).toBe(2);
  });
});

describe("snippetFor", () => {
  it("truncates long content", () => {
    const snip = snippetFor("word ".repeat(100), 20);
    expect(snip.length).toBeLessThanOrEqual(21);
    expect(snip.endsWith("…")).toBe(true);
  });
  it("leaves short content untouched", () => {
    expect(snippetFor("short text")).toBe("short text");
  });
});

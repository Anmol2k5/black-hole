import { describe, it, expect } from "vitest";
import {
  ObservationSchema,
  ChunkLocationSchema,
  ObservationType,
  OBSERVATION_TYPES,
} from "@/lib/extraction/schemas";

describe("ObservationSchema", () => {
  it("accepts a valid observation", () => {
    const obs = ObservationSchema.parse({
      type: "feature_request",
      text: "Customers want Slack integration",
      severity: "high",
      sentiment: "neutral",
      confidence: 0.9,
    });
    expect(obs.type).toBe("feature_request");
    expect(obs.entityNames).toEqual([]);
  });

  it("rejects empty text", () => {
    expect(() =>
      ObservationSchema.parse({
        type: "bug",
        text: "",
        severity: "low",
        sentiment: "negative",
        confidence: 0.5,
      }),
    ).toThrow();
  });

  it("rejects out-of-range confidence", () => {
    expect(() =>
      ObservationSchema.parse({
        type: "bug",
        text: "x",
        severity: "low",
        sentiment: "negative",
        confidence: 1.5,
      }),
    ).toThrow();
  });

  it("rejects unknown observation type", () => {
    expect(() =>
      ObservationSchema.parse({
        type: "wish",
        text: "x",
        severity: "low",
        sentiment: "neutral",
        confidence: 0.5,
      }),
    ).toThrow();
  });
});

describe("ChunkLocationSchema", () => {
  it("accepts optional location fields", () => {
    const loc = ChunkLocationSchema.parse({ pageNumber: 7, speaker: "Jane" });
    expect(loc.pageNumber).toBe(7);
  });
});

describe("OBSERVATION_TYPES", () => {
  it("includes the ten expected types", () => {
    expect(OBSERVATION_TYPES.length).toBe(10);
    expect(OBSERVATION_TYPES).toContain("competitor_mention" as ObservationType);
  });
});

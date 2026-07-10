import { describe, it, expect } from "vitest";
import {
  canonicalizeText,
  tokenize,
  tokenSimilarity,
} from "@/lib/claims/normalizer";

describe("canonicalizeText", () => {
  it("lowercases and strips punctuation", () => {
    expect(canonicalizeText("Users want Slack integration!")).toBe("users want slack integration");
  });
});

describe("tokenize", () => {
  it("drops very short tokens", () => {
    const tokens = tokenize("We want API access now");
    expect(tokens.has("we")).toBe(false);
    expect(tokens.has("api")).toBe(true);
  });
});

describe("tokenSimilarity", () => {
  it("is 1 for identical text", () => {
    expect(tokenSimilarity("slack integration needed", "slack integration needed")).toBe(1);
  });

  it("is between 0 and 1 for partial overlap", () => {
    const sim = tokenSimilarity("want slack integration", "need slack connection");
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it("is 0 for disjoint text", () => {
    expect(tokenSimilarity("alpha beta", "gamma delta")).toBe(0);
  });
});

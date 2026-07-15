import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getDb, closeDb } from "@/lib/db/client";
import { storeObservationsForSource, rebuildClaims, getClaims } from "@/lib/claims/repository";
import { ensureWikiPagesFromDefinitions, compileWikiFromClaims } from "@/lib/wiki/compiler-v2";
import { ObservationSchema } from "@/lib/extraction/schemas";

function resetDb(): void {
  const db = getDb();
  db.exec("DELETE FROM wiki_pages; DELETE FROM wiki_page_versions; DELETE FROM observations; DELETE FROM claims; DELETE FROM claim_evidence; DELETE FROM sources; DELETE FROM chunks;");
}

function makeSource(id: string): void {
  getDb()
    .prepare(
      "INSERT INTO sources (id, filename, original_name, file_path, file_type, category, file_size, checksum_sha256, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')",
    )
    .run(id, `${id}.txt`, `${id}.txt`, `/tmp/${id}.txt`, "txt", "docs", 10, id);
}

function obs(type: string, text: string, severity = "high", confidence = 0.9) {
  return ObservationSchema.parse({ type, text, severity, sentiment: "neutral", confidence });
}

describe("claims layer", () => {
  beforeEach(resetDb);

  it("normalizes repeated observations into a single claim with unique-source count", () => {
    makeSource("src-1"); const s1 = "src-1";
    makeSource("src-2"); const s2 = "src-2";
    // Two different sources expressing the same idea.
    storeObservationsForSource("default", s1, [
      obs("feature_request", "Users want Slack integration", "high", 0.9),
    ]);
    storeObservationsForSource("default", s2, [
      obs("feature_request", "Customers want Slack integration", "high", 0.85),
    ]);

    rebuildClaims("default");

    const claims = getClaims("default", "feature_request");
    expect(claims.length).toBe(1);
    expect(claims[0].mention_count).toBe(2);
    expect(claims[0].unique_source_count).toBe(2);
    expect(claims[0].confidence).toBeGreaterThan(0);
  });

  it("does not over-count a single loud source", () => {
    makeSource("loud-src"); const s1 = "loud-src";
    storeObservationsForSource("default", s1, [
      obs("feature_request", "Slack is needed", "high", 0.9),
      obs("feature_request", "We need Slack support", "high", 0.9),
      obs("feature_request", "Slack integration please", "high", 0.9),
    ]);
    rebuildClaims("default");
    const claims = getClaims("default", "feature_request");
    // The three near-duplicate mentions should collapse and the unique-source
    // count must stay 1 (one real customer), not 3.
    expect(claims.every((c) => c.unique_source_count <= 1)).toBe(true);
  });
});

describe("wiki compilation from claims", () => {
  beforeEach(resetDb);

  it("creates configured pages and renders claims with evidence", async () => {
    makeSource("src-a"); const s1 = "src-a";
    storeObservationsForSource("default", s1, [
      obs("feature_request", "Customers want Slack integration", "high", 0.9),
      obs("pricing_feedback", "Pricing feels expensive for small teams", "medium", 0.7),
    ]);
    rebuildClaims("default");

    ensureWikiPagesFromDefinitions();
    await compileWikiFromClaims("default");

    const pages = getDb()
      .prepare("SELECT slug, title, content_md FROM wiki_pages ORDER BY slug")
      .all() as Array<{ slug: string; title: string; content_md: string }>;

    const slugs = pages.map((p) => p.slug);
    expect(slugs).toContain("product/requested-features");
    expect(slugs).toContain("sales/pricing-objections");

    const features = pages.find((p) => p.slug === "product/requested-features")!;
    expect(features.content_md).toContain("Slack integration");
    expect(features.content_md).toContain("Evidence");
  });

  it("stores a previous version before overwriting", async () => {
    makeSource("src-b"); const s1 = "src-b";
    storeObservationsForSource("default", s1, [obs("feature_request", "First version claim", "medium", 0.6)]);
    rebuildClaims("default");
    ensureWikiPagesFromDefinitions();
    await compileWikiFromClaims("default");

    storeObservationsForSource("default", s1, [obs("feature_request", "Second version claim", "medium", 0.6)]);
    rebuildClaims("default");
    await compileWikiFromClaims("default");

    const versions = getDb()
      .prepare("SELECT COUNT(*) as c FROM wiki_page_versions")
      .get() as { c: number };
    expect(versions.c).toBeGreaterThanOrEqual(1);
  });
});

afterAll(() => closeDb());


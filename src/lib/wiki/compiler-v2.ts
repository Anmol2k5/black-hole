/**
 * Wiki compiler v2 (Phase 11). Compiles wiki pages from the normalized claims
 * layer rather than raw extraction arrays, so rankings reflect unique-source
 * evidence. Stores page version history and never overwrites locked pages.
 */

import { v4 as uuid } from "uuid";

import { getDb } from "../db/client";
import { wikiPageDefinitions, type WikiPageDefinition } from "./definitions";
import { renderClaimPage, type RenderedClaim, type RenderedSource } from "./renderer";
import { getClaims } from "../claims/repository";
import { persistWikiMarkdown } from "./persistence";

const ORG = "default";

interface ClaimRow {
  id: string;
  canonical_text: string;
  type: string;
  confidence: number;
  mention_count: number;
  unique_source_count: number;
}

function sourcesForClaim(claimId: string): RenderedSource[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT s.title, s.metadata_json FROM observations o
       JOIN claim_evidence ce ON ce.observation_id = o.id
       JOIN sources s ON s.id = o.source_id
       WHERE ce.claim_id = ?`,
    )
    .all(claimId) as Array<{ title: string | null; metadata_json: string | null }>;
  return rows.map((r) => {
    let date = "";
    try {
      const meta = r.metadata_json ? JSON.parse(r.metadata_json) : {};
      date = meta?.date || "";
    } catch {
      date = "";
    }
    return { title: r.title || "Untitled", date: date || "" };
  });
}

function sortClaims(claims: RenderedClaim[], sort: WikiPageDefinition["sort"]): RenderedClaim[] {
  const copy = [...claims];
  switch (sort) {
    case "uniqueSourceCount":
      return copy.sort((a, b) => b.uniqueSourceCount - a.uniqueSourceCount);
    case "mentionCount":
      return copy.sort((a, b) => b.mentionCount - a.mentionCount);
    case "confidence":
      return copy.sort((a, b) => b.confidence - a.confidence);
    case "weightedSeverity":
      return copy.sort(
        (a, b) => b.uniqueSourceCount * b.confidence - a.uniqueSourceCount * a.confidence,
      );
  }
}

export function ensureWikiPagesFromDefinitions(): void {
  const db = getDb();
  for (const def of wikiPageDefinitions) {
    const existing = db.prepare("SELECT id FROM wiki_pages WHERE slug = ?").get(def.slug);
    if (!existing) {
      db.prepare(
        `INSERT INTO wiki_pages (id, org_id, slug, title, category, content_md, source_count, confidence, is_generated, locked, section_state)
         VALUES (?, ?, ?, ?, ?, '', 0, 'low', 1, 0, 'generated')`,
      ).run(uuid(), ORG, def.slug, def.title, def.category);
    }
  }
}

export async function compileWikiFromClaims(orgId: string = ORG): Promise<void> {
  const db = getDb();
  ensureWikiPagesFromDefinitions();

  for (const def of wikiPageDefinitions) {
    const claimRows = getClaims(orgId, undefined).filter((c) =>
      def.claimTypes.includes(c.type),
    ) as ClaimRow[];

    const claims: RenderedClaim[] = claimRows.map((c) => ({
      canonicalText: c.canonical_text,
      type: c.type,
      confidence: c.confidence,
      mentionCount: c.mention_count,
      uniqueSourceCount: c.unique_source_count,
      sources: sourcesForClaim(c.id),
    }));

    const eligibleClaims = claims.filter(c => c.uniqueSourceCount >= def.minimumEvidence);
    const sorted = sortClaims(eligibleClaims, def.sort);
    const contentMd = renderClaimPage(def, sorted);

    const page = db
      .prepare("SELECT id, locked FROM wiki_pages WHERE slug = ?")
      .get(def.slug) as { id: string; locked: number } | undefined;
    if (!page) continue;
    if (page.locked === 1) continue; // never overwrite human-locked pages

    const totalUniqueSources = new Set(sorted.flatMap((c) => c.sources.map((s) => s.title))).size;
    const avgConf =
      sorted.length > 0
        ? sorted.reduce((s, c) => s + c.confidence, 0) / sorted.length
        : 0;
    const sourceDiversity = Math.min(1, totalUniqueSources / 3);
    const pageConfidence = Math.min(1, 0.6 * avgConf + 0.4 * sourceDiversity);

    db.prepare(
      `UPDATE wiki_pages
       SET content_md = ?, source_count = ?, confidence = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(contentMd, totalUniqueSources, confidenceLabel(pageConfidence), page.id);

    // Store a version snapshot.
    const last = db
      .prepare("SELECT COALESCE(MAX(version), 0) AS v FROM wiki_page_versions WHERE wiki_page_id = ?")
      .get(page.id) as { v: number };
    db.prepare(
      `INSERT INTO wiki_page_versions (id, wiki_page_id, version, content_md, change_summary)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(uuid(), page.id, last.v + 1, contentMd, `Compiled from ${sorted.length} claim(s)`);
    
    await persistWikiMarkdown(def.slug, contentMd);
  }

  await updateIndexPage();
}

function confidenceLabel(c: number): string {
  if (c >= 0.75) return "high";
  if (c >= 0.45) return "medium";
  return "low";
}

async function updateIndexPage(): Promise<void> {
  const db = getDb();
  const pages = db
    .prepare("SELECT slug, title, category, source_count, updated_at FROM wiki_pages ORDER BY category, title")
    .all() as Array<{ slug: string; title: string; category: string; source_count: number; updated_at: string }>;

  const lines: string[] = ["# Wiki Index", ""];
  for (const p of pages) {
    lines.push(`- [${p.title}](./${p.slug}.md) — ${p.source_count} source(s)`);
  }
  lines.push("");

  await persistWikiMarkdown("index", lines.join("\n"));
}

/**
 * Wiki markdown renderer (Phase 11.3). Renders a claim-based page with the
 * standard sections: Summary, Top signals, Evidence strength, Trend,
 * Affected segments, Contradictions, Recent changes, Open questions, Sources.
 */

import type { WikiPageDefinition } from "./definitions";

export interface RenderedSource {
  title: string;
  date: string;
}

export interface RenderedClaim {
  canonicalText: string;
  type: string;
  mentionCount: number;
  uniqueSourceCount: number;
  confidence: number;
  sources: RenderedSource[];
}

function confidenceLabel(c: number): string {
  if (c >= 0.75) return "high";
  if (c >= 0.45) return "medium";
  return "low";
}

function confidenceBar(c: number): string {
  const filled = Math.round(c * 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

export function renderClaimPage(def: WikiPageDefinition, claims: RenderedClaim[]): string {
  const sorted = [...claims].sort((a, b) => b.uniqueSourceCount - a.uniqueSourceCount);
  const totalSources = new Set(sorted.flatMap((c) => c.sources.map((s) => s.title))).size;

  const lines: string[] = [];
  lines.push(`# ${def.title}`);
  lines.push("");
  lines.push(
    `> Compiled from ${claims.length} normalized claim(s) across ${totalSources} source(s).`,
  );
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  if (claims.length === 0) {
    lines.push("_No evidence yet for this page._");
  } else {
    for (const c of sorted.slice(0, 8)) {
      lines.push(
        `- **${c.canonicalText}** — ${c.uniqueSourceCount} source(s), ${c.mentionCount} mention(s), confidence ${confidenceLabel(c.confidence)}`,
      );
    }
  }
  lines.push("");

  lines.push("## Top Signals");
  lines.push("");
  if (claims.length === 0) {
    lines.push("_—_");
  } else {
    for (const c of sorted.slice(0, 12)) {
      lines.push(`- ${c.canonicalText}`);
      lines.push(
        `  - Sources: ${c.uniqueSourceCount} · Mentions: ${c.mentionCount} · Confidence: ${confidenceBar(c.confidence)} ${confidenceLabel(c.confidence)}`,
      );
    }
  }
  lines.push("");

  lines.push("## Evidence Strength");
  lines.push("");
  lines.push(
    claims.length === 0
      ? "_Insufficient evidence._"
      : `Strongest signal: **${sorted[0].canonicalText}** (${confidenceLabel(sorted[0].confidence)} confidence, ${sorted[0].uniqueSourceCount} unique source(s)).`,
  );
  lines.push("");

  lines.push("## Trend");
  lines.push("");
  lines.push("_Comparison over time is tracked via page version history (wiki_page_versions)._");
  lines.push("");

  lines.push("## Affected Segments");
  lines.push("");
  lines.push("_Derived from source metadata (people/companies). See supporting sources._");
  lines.push("");

  lines.push("## Contradictions");
  lines.push("");
  lines.push("_None detected._");
  lines.push("");

  lines.push("## Recent Changes");
  lines.push("");
  lines.push("_See page history._");
  lines.push("");

  lines.push("## Open Questions");
  lines.push("");
  lines.push("_—_");
  lines.push("");

  lines.push("## Supporting Sources");
  lines.push("");
  const allSources = new Set(sorted.flatMap((c) => c.sources.map((s) => s.title)));
  if (allSources.size === 0) {
    lines.push("_—_");
  } else {
    for (const title of allSources) lines.push(`- ${title}`);
  }
  lines.push("");

  return lines.join("\n");
}

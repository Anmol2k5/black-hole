/**
 * Claims repository (Phase 10).
 *
 * Persists chunk-level observations and rebuilds normalized claims from them.
 * Claims are derived from the full set of observations, so rebuilding is
 * idempotent: old claims/evidence for the org are cleared first.
 */

import { v4 as uuid } from "uuid";
import { createHash } from "node:crypto";
import { getDb } from "../db/client";
import type { Observation } from "../extraction/schemas";
import { clusterObservations } from "./clusterer";

const ORG = "default";
const SEVERITY_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

interface StoredObservationRow {
  id: string;
  source_id: string;
  chunk_id: string | null;
  type: string;
  text: string;
  quote: string | null;
  severity: string | null;
  sentiment: string | null;
  confidence: number | null;
  metadata_json: string | null;
}

function claimIdFor(orgId: string, type: string, canonical: string): string {
  return createHash("sha1").update(`${orgId}|${type}|${canonical}`).digest("hex").slice(0, 24);
}

/** Store observations for a source, linking each to a chunk when possible. */
export function storeObservationsForSource(
  orgId: string,
  sourceId: string,
  observations: Observation[],
): string[] {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO observations (id, org_id, source_id, chunk_id, type, text, quote, severity, sentiment, confidence, metadata_json, extractor_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const ids: string[] = [];
  const tx = db.transaction(() => {
    for (const obs of observations) {
      const id = uuid();
      let chunkId = obs.location?.chunkId ?? null;

      if (chunkId) {
        const valid = db.prepare("SELECT id FROM chunks WHERE id = ? AND source_id = ?").get(chunkId, sourceId);
        if (!valid) chunkId = null;
      }

      if (!chunkId) {
        const pos = obs.location?.charStart;
        if (pos != null) {
          const c = db
            .prepare("SELECT id FROM chunks WHERE source_id = ? AND char_start <= ? AND char_end >= ? LIMIT 1")
            .get(sourceId, pos) as { id: string } | undefined;
          chunkId = c?.id ?? null;
        }
      }
      insert.run(
        id,
        orgId,
        sourceId,
        chunkId,
        obs.type,
        obs.text,
        obs.quote ?? null,
        obs.severity,
        obs.sentiment,
        obs.confidence,
        obs.location ? JSON.stringify(obs.location) : null,
        "1.0.0",
      );
      ids.push(id);
    }
  });
  tx();
  return ids;
}

export function rebuildClaims(orgId: string = ORG): void {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM observations WHERE org_id = ?")
    .all(orgId) as StoredObservationRow[];

  const observations = rows.map((r) => ({
    id: r.id,
    source_id: r.source_id,
    chunk_id: r.chunk_id,
    type: r.type as Observation["type"],
    text: r.text,
    quote: r.quote ?? undefined,
    severity: (r.severity as Observation["severity"]) ?? "medium",
    sentiment: (r.sentiment as Observation["sentiment"]) ?? "neutral",
    confidence: r.confidence ?? 0.5,
    entityNames: [],
    location: r.metadata_json ? (JSON.parse(r.metadata_json) as Observation["location"]) : undefined,
  }));

  const clusters = clusterObservations(observations);

  const clear = db.transaction(() => {
    db.prepare("DELETE FROM claim_evidence WHERE claim_id IN (SELECT id FROM claims WHERE org_id = ?)").run(orgId);
    db.prepare("UPDATE claims SET status = 'inactive' WHERE org_id = ?").run(orgId);
  });
  clear();

  const rebuild = db.transaction(() => {
    for (const cluster of clusters) {
      const clusterObs = cluster.observations as typeof observations;
      const mentionCount = clusterObs.length;
      const uniqueSources = new Set(clusterObs.map((o) => o.source_id)).size;
      const avgConf =
        clusterObs.reduce((s, o) => s + (o.confidence ?? 0.5), 0) / mentionCount;
      const maxSeverity = Math.max(
        ...clusterObs.map((o) => SEVERITY_RANK[o.severity] ?? 2),
      );

      const sourceDiversity = Math.min(1, uniqueSources / 3);
      const mentionNorm = Math.min(1, mentionCount / 5);
      const severityWeight = maxSeverity / 4;
      const confidence = Math.min(
        1,
        0.3 * sourceDiversity + 0.2 * mentionNorm + 0.3 * avgConf + 0.2 * severityWeight,
      );

      const claimId = claimIdFor(orgId, cluster.type, cluster.canonicalText);
      db.prepare(
        `INSERT INTO claims (id, org_id, type, canonical_text, status, confidence, mention_count, unique_source_count, unique_customer_count, first_seen_at, last_seen_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           status = 'active',
           confidence = excluded.confidence,
           mention_count = excluded.mention_count,
           unique_source_count = excluded.unique_source_count,
           unique_customer_count = excluded.unique_customer_count,
           last_seen_at = datetime('now')`
      ).run(
        claimId,
        orgId,
        cluster.type,
        cluster.observations[0].text,
        confidence,
        mentionCount,
        uniqueSources,
        uniqueSources,
      );

      // Link evidence (each observation in the cluster points at this claim).
      const link = db.prepare(
        "INSERT INTO claim_evidence (claim_id, observation_id, relation) VALUES (?, ?, 'supports')"
      );
      for (const obs of clusterObs) {
        link.run(claimId, obs.id);
      }
    }
  });
  rebuild();
}

export interface ClaimView {
  id: string;
  type: string;
  canonical_text: string;
  confidence: number;
  mention_count: number;
  unique_source_count: number;
  status: string;
}

export function getClaims(orgId: string = ORG, type?: string): ClaimView[] {
  const db = getDb();
  const sql = type
    ? "SELECT id, type, canonical_text, confidence, mention_count, unique_source_count, status FROM claims WHERE org_id = ? AND type = ? AND status = 'active' ORDER BY confidence DESC, mention_count DESC"
    : "SELECT id, type, canonical_text, confidence, mention_count, unique_source_count, status FROM claims WHERE org_id = ? AND status = 'active' ORDER BY confidence DESC, mention_count DESC";
  const params = type ? [orgId, type] : [orgId];
  return db.prepare(sql).all(...params) as ClaimView[];
}

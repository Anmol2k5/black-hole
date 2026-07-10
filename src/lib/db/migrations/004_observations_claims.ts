import type Database from "better-sqlite3";

export const version = 4;
export const name = "observations_claims";

/**
 * Creates the normalized claims layer:
 *  - observations: one row per extracted signal, linked to source + chunk
 *  - claims: normalized, deduplicated signals with frequency metrics
 *  - claim_evidence: relation between a claim and the observations supporting it
 */
export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL DEFAULT 'default',
      source_id TEXT NOT NULL,
      chunk_id TEXT,
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      quote TEXT,
      severity TEXT,
      sentiment TEXT,
      confidence REAL,
      metadata_json TEXT,
      extractor_version TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE,
      FOREIGN KEY(chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL DEFAULT 'default',
      type TEXT NOT NULL,
      canonical_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      confidence REAL NOT NULL DEFAULT 0,
      mention_count INTEGER NOT NULL DEFAULT 0,
      unique_source_count INTEGER NOT NULL DEFAULT 0,
      unique_customer_count INTEGER NOT NULL DEFAULT 0,
      first_seen_at TEXT,
      last_seen_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS claim_evidence (
      claim_id TEXT NOT NULL,
      observation_id TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT 'supports',
      PRIMARY KEY(claim_id, observation_id),
      FOREIGN KEY(claim_id) REFERENCES claims(id) ON DELETE CASCADE,
      FOREIGN KEY(observation_id) REFERENCES observations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_observations_source ON observations(source_id);
    CREATE INDEX IF NOT EXISTS idx_observations_chunk ON observations(chunk_id);
    CREATE INDEX IF NOT EXISTS idx_claims_type ON claims(type);
    CREATE INDEX IF NOT EXISTS idx_claim_evidence_obs ON claim_evidence(observation_id);
  `);
}

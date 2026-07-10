/**
 * Lightweight migration runner.
 *
 * Migrations are numbered modules under ./migrations that export
 * `{ version, name, up }`. Applied versions are tracked in `schema_migrations`
 * so re-running is idempotent. Never edit a published migration; add a new one.
 */

import type Database from "better-sqlite3";
import * as m001 from "./migrations/001_initial";

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

const MIGRATIONS: Migration[] = [
  { version: m001.version, name: m001.name, up: m001.up },
];

export function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function getAppliedVersions(db: Database.Database): Set<number> {
  const rows = db
    .prepare("SELECT version FROM schema_migrations")
    .all() as { version: number }[];
  return new Set(rows.map((r) => r.version));
}

export function runMigrations(db: Database.Database): void {
  ensureMigrationsTable(db);

  const applied = getAppliedVersions(db);
  const pending = MIGRATIONS.filter((m) => !applied.has(m.version)).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    const apply = db.transaction(() => {
      migration.up(db);
      db.prepare(
        "INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (?, ?)",
      ).run(migration.version, migration.name);
    });
    apply();
  }
}

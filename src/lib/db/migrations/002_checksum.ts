import type Database from "better-sqlite3";

export const version = 2;
export const name = "checksum";

/**
 * Adds checksum_sha256 to sources for idempotent / duplicate ingestion.
 * Idempotent: only alters the table if the column is missing.
 */
export function up(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(sources)").all() as Array<{
    name: string;
  }>;
  if (!columns.some((c) => c.name === "checksum_sha256")) {
    db.exec("ALTER TABLE sources ADD COLUMN checksum_sha256 TEXT");
  }
}

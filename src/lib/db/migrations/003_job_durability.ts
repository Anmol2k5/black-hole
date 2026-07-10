import type Database from "better-sqlite3";

export const version = 3;
export const name = "job_durability";

const COLUMNS = [
  "attempt_count",
  "max_attempts",
  "locked_at",
  "locked_by",
  "next_attempt_at",
  "progress_percent",
];

/**
 * Adds durable job-processing columns. Idempotent.
 */
export function up(db: Database.Database): void {
  const existing = new Set(
    (db.prepare("PRAGMA table_info(jobs)").all() as Array<{ name: string }>).map(
      (c) => c.name,
    ),
  );
  for (const col of COLUMNS) {
    if (!existing.has(col)) {
      db.exec(`ALTER TABLE jobs ADD COLUMN ${col} ${columnType(col)}`);
    }
  }
}

function columnType(col: string): string {
  switch (col) {
    case "attempt_count":
    case "max_attempts":
    case "total_steps":
    case "completed_steps":
    case "progress_percent":
      return "INTEGER DEFAULT 0";
    default:
      return "TEXT";
  }
}

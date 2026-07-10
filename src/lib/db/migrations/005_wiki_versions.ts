import type Database from "better-sqlite3";

export const version = 5;
export const name = "wiki_versions";

/**
 * Adds wiki page version history and a lock flag for human-edited sections.
 * Idempotent.
 */
export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wiki_page_versions (
      id TEXT PRIMARY KEY,
      wiki_page_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      content_md TEXT NOT NULL,
      change_summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(wiki_page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE
    );
  `);

  const cols = new Set(
    (db.prepare("PRAGMA table_info(wiki_pages)").all() as Array<{ name: string }>).map(
      (c) => c.name,
    ),
  );
  if (!cols.has("locked")) {
    db.exec("ALTER TABLE wiki_pages ADD COLUMN locked INTEGER DEFAULT 0");
  }
  if (!cols.has("section_state")) {
    db.exec("ALTER TABLE wiki_pages ADD COLUMN section_state TEXT DEFAULT 'generated'");
  }
}

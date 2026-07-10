/**
 * SQLite database client singleton.
 * Stores the DB under the single workspace root (DATA_DIR) and runs migrations
 * on first access.
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import { getDatabasePath, getDatabaseDirectory, ensureWorkspaceDirectories } from "../paths";
import { runMigrations } from "./migrate";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  ensureWorkspaceDirectories();

  const dbDir = getDatabaseDirectory();
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = getDatabasePath();
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Run schema migrations (idempotent).
  runMigrations(db);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

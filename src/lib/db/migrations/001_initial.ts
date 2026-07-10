import type Database from "better-sqlite3";
import { SCHEMA_SQL } from "../schema";

export const version = 1;
export const name = "initial";

/**
 * Creates the baseline schema. Uses the existing IF NOT EXISTS definitions so
 * it is safe to run against a database that was previously initialized by the
 * legacy SCHEMA_SQL path. Later migrations evolve the schema without dropping
 * tables.
 */
export function up(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
}

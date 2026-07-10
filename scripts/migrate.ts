/**
 * Apply in-database schema migrations. Safe to run repeatedly.
 * Usage: npm run db:migrate
 */
import { getDb } from "../src/lib/db/client";
import { getAppliedVersions } from "../src/lib/db/migrate";

const db = getDb();
const applied = getAppliedVersions(db);
console.log(
  `Migrations applied: ${[...applied].sort((a, b) => a - b).join(", ") || "(none)"}`,
);
console.log("Database is up to date.");
process.exit(0);

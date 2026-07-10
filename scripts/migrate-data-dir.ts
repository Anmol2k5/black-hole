/**
 * One-time migration: move the legacy database out of `.company-brain/`
 * into the unified workspace root (DATA_DIR/brain.db).
 *
 * Behaviour:
 *  - If .company-brain/brain.db exists AND DATA_DIR/brain.db does not: copy it,
 *    verify the copy opens, then rename the old DB to brain.db.backup.
 *  - Never silently deletes the original database.
 *
 * Usage: tsx scripts/migrate-data-dir.ts
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getDatabasePath, ensureWorkspaceDirectories } from "../src/lib/paths";

const oldDbPath = path.resolve(process.cwd(), ".company-brain", "brain.db");
const newDbPath = getDatabasePath();

function main(): void {
  if (!fs.existsSync(oldDbPath)) {
    console.log("No legacy database found at .company-brain/brain.db. Nothing to do.");
    return;
  }

  if (fs.existsSync(newDbPath)) {
    console.log(
      `Target database already exists at ${newDbPath}. Leaving the legacy file in place.`,
    );
    console.log(
      "If you intend to migrate, back up and remove the target, then re-run.",
    );
    return;
  }

  ensureWorkspaceDirectories();

  console.log(`Copying ${oldDbPath} -> ${newDbPath}`);
  fs.copyFileSync(oldDbPath, newDbPath);

  // Verify the copy opens and is a valid SQLite database.
  let verified = false;
  try {
    const probe = new Database(newDbPath, { readonly: true });
    probe.prepare("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1").get();
    probe.close();
    verified = true;
  } catch (err) {
    console.error("Verification failed, removing the copy:", err);
    fs.rmSync(newDbPath, { force: true });
    process.exit(1);
  }

  if (!verified) {
    fs.rmSync(newDbPath, { force: true });
    process.exit(1);
  }

  const backupPath = `${oldDbPath}.backup`;
  console.log(`Renaming original to ${backupPath}`);
  fs.renameSync(oldDbPath, backupPath);

  // Best-effort: move the WAL/SHM sidecar files too.
  for (const ext of ["-wal", "-shm"]) {
    const sidecar = `${oldDbPath}${ext}`;
    if (fs.existsSync(sidecar)) {
      fs.renameSync(sidecar, `${backupPath}${ext}`);
    }
  }

  console.log("Migration complete. The workspace database now lives at:");
  console.log(newDbPath);
}

main();

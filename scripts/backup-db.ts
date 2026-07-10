/**
 * Back up the complete workspace into a single zip archive.
 *
 * Includes: database, raw files, extracted metadata, wiki pages, and a
 * configuration manifest (without API secrets).
 *
 * Usage: npm run db:backup
 */
import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";
import {
  getDatabasePath,
  getDataRoot,
  getRawDirectory,
  getWikiDirectory,
  getExtractedDirectory,
} from "../src/lib/paths";
import { getConfig } from "../src/lib/config";

function copyDirIfExists(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirIfExists(s, d);
    else fs.copyFileSync(s, d);
  }
}

function safeConfigManifest() {
  const c = getConfig();
  return {
    companyName: c.companyName,
    dataDir: c.dataDir,
    llmProvider: c.llmProvider,
    llmModel: c.llmModel,
    embeddingProvider: c.embeddingProvider,
    embeddingModel: c.embeddingModel,
    maxChunkSize: c.maxChunkSize,
    chunkOverlap: c.chunkOverlap,
    // NOTE: API keys are intentionally excluded.
    backedUpAt: new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupsDir = path.resolve(process.cwd(), "backups");
  fs.mkdirSync(backupsDir, { recursive: true });

  const folderName = `black-hole-${timestamp}`;
  const folderPath = path.join(backupsDir, folderName);
  fs.mkdirSync(folderPath, { recursive: true });

  // Database (and sidecars)
  const dbDir = path.join(folderPath, "db");
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = getDatabasePath();
  if (fs.existsSync(dbPath)) {
    for (const ext of ["", "-wal", "-shm"]) {
      const f = `${dbPath}${ext}`;
      if (fs.existsSync(f)) fs.copyFileSync(f, path.join(dbDir, `brain.db${ext}`));
    }
  }

  // Knowledge + raw data
  copyDirIfExists(getRawDirectory(), path.join(folderPath, "raw"));
  copyDirIfExists(getExtractedDirectory(), path.join(folderPath, "extracted"));
  copyDirIfExists(getWikiDirectory(), path.join(folderPath, "wiki"));

  // Config manifest (no secrets)
  fs.writeFileSync(
    path.join(folderPath, "config-manifest.json"),
    JSON.stringify(safeConfigManifest(), null, 2),
  );

  // Zip the folder
  const zipPath = path.join(backupsDir, `${folderName}.zip`);
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(folderPath, folderName);
    archive.finalize();
  });

  console.log(`Backup written to: ${zipPath}`);
  console.log(`Workspace root was: ${getDataRoot()}`);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});

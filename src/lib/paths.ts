/**
 * Centralized workspace path resolution.
 *
 * A single workspace is rooted at DATA_DIR. The SQLite database, raw files,
 * extracted metadata, generated wiki, and temporary files all live under this
 * one root so the complete workspace can be backed up by copying a folder.
 */

import path from "node:path";
import fs from "node:fs";
import { getConfig } from "./config";

export function getDataRoot(): string {
  return getConfig().dataDir;
}

/** Absolute path to the SQLite database file. */
export function getDatabasePath(): string {
  const configured = process.env.DB_PATH;

  return configured
    ? path.resolve(configured)
    : path.join(getDataRoot(), "brain.db");
}

/** Directory that holds the SQLite database file. */
export function getDatabaseDirectory(): string {
  return path.dirname(getDatabasePath());
}

export function getRawDirectory(): string {
  return path.join(getDataRoot(), "raw");
}

export function getWikiDirectory(): string {
  return path.join(getDataRoot(), "wiki");
}

export function getExtractedDirectory(): string {
  return path.join(getDataRoot(), "extracted");
}

export function getTemporaryDirectory(): string {
  return path.join(getDataRoot(), "tmp");
}

/** Ensure all workspace directories exist. Safe to call repeatedly. */
export function ensureWorkspaceDirectories(): void {
  for (const dir of [
    getDataRoot(),
    getDatabaseDirectory(),
    getRawDirectory(),
    getWikiDirectory(),
    getExtractedDirectory(),
    getTemporaryDirectory(),
  ]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

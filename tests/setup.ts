/**
 * Test setup. Use an isolated temp workspace so tests never touch real data
 * and never commit uploaded files. The DATA_DIR is set before any module that
 * reads config is imported, because getConfig() caches its result lazily.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "blackhole-test-"));
process.env.DATA_DIR = path.join(testRoot, "data");
(process.env as Record<string, string>).NODE_ENV = "test";

// Disable network-dependent AI features during tests unless explicitly enabled.
if (!process.env.LLM_API_KEY) {
  process.env.AI_PROCESSING = "false";
}

export const TEST_DATA_DIR = process.env.DATA_DIR;

// Ensure a clean workspace for every test process.
export function cleanupTestData(): void {
  try {
    fs.rmSync(testRoot, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

process.on("exit", cleanupTestData);

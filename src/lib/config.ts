/**
 * Runtime configuration from environment variables.
 * All config is read once and cached for the process lifetime.
 */

import path from 'path';
import fs from 'node:fs';

export interface AppConfig {
  // LLM
  llmProvider: 'openai' | 'anthropic' | 'ollama';
  llmModel: string;
  llmApiKey: string;
  llmBaseUrl?: string;

  // Embeddings
  embeddingProvider: 'openai' | 'ollama';
  embeddingModel: string;
  embeddingApiKey: string;
  embeddingBaseUrl?: string;

  // Data
  dataDir: string;
  companyName: string;

  // Chunking
  maxChunkSize: number;
  chunkOverlap: number;
}

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (_config) return _config;

  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(process.cwd(), 'data');

  _config = {
    llmProvider: (process.env.LLM_PROVIDER as AppConfig['llmProvider']) || 'openai',
    llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
    llmApiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
    llmBaseUrl: process.env.LLM_BASE_URL || undefined,

    embeddingProvider: (process.env.EMBEDDING_PROVIDER as AppConfig['embeddingProvider']) || 'openai',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    embeddingApiKey: process.env.EMBEDDING_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
    embeddingBaseUrl: process.env.EMBEDDING_BASE_URL || process.env.LLM_BASE_URL || undefined,

    dataDir,
    companyName: process.env.COMPANY_NAME || 'Our Company',

    maxChunkSize: parseInt(process.env.MAX_CHUNK_SIZE || '500', 10),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '50', 10),
  };

  return _config;
}

/** Resolve a path relative to the data directory */
export function dataPath(...segments: string[]): string {
  return path.join(getConfig().dataDir, ...segments);
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export interface RuntimeValidation {
  errors: string[];
  warnings: string[];
}

function pathContainsSegment(target: string, segment: string): boolean {
  const lower = target.toLowerCase();
  const sep = path.sep.toLowerCase();
  const needle = `${sep}${segment.toLowerCase()}${sep}`;
  const trailing = `${sep}${segment.toLowerCase()}`;
  return lower.includes(needle) || lower.endsWith(trailing);
}

function isInsideGitRepo(dir: string): boolean {
  let current = path.resolve(dir);
  // Walk up at most a few levels looking for a .git directory.
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return true;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return false;
}

/**
 * Production safety checks. Called once at server startup via instrumentation.
 * In production, any error throws and prevents the server from starting.
 * In development, errors/warnings are logged but do not abort startup.
 */
export function validateRuntime(): RuntimeValidation {
  const config = getConfig();
  const errors: string[] = [];
  const warnings: string[] = [];

  const production = isProduction();
  const dataDir = config.dataDir;
  const resolvedDataDir = path.resolve(dataDir);

  // Never store the workspace inside a publicly served directory.
  if (pathContainsSegment(resolvedDataDir, "public")) {
    errors.push(
      `DATA_DIR (${resolvedDataDir}) resolves inside a public directory. ` +
        `Uploaded data and the database must never be served statically.`,
    );
  }

  // Warn (and error in production) when the workspace lives inside a git repo,
  // since that risks committing real company data.
  if (isInsideGitRepo(resolvedDataDir)) {
    const msg =
      `DATA_DIR (${resolvedDataDir}) is inside a Git repository. ` +
      `Ensure .gitignore excludes it.`;
    if (production) errors.push(msg);
    else warnings.push(msg);
  }

  // Seed route must be disabled in production.
  const seedEnabled = (process.env.ENABLE_SEED_ROUTE ?? "false") === "true";
  if (production && seedEnabled) {
    errors.push(
      "ENABLE_SEED_ROUTE must be false in production. Demo seed data must " +
        "not be triggerable.",
    );
  }

  // Reject empty API credentials when AI processing is enabled in production.
  const aiEnabled = (process.env.AI_PROCESSING ?? "true") !== "false";
  if (production && aiEnabled && !config.llmApiKey) {
    errors.push(
      "LLM_API_KEY is empty. AI processing cannot run in production without " +
        "credentials. Set a valid key or disable AI processing explicitly.",
    );
  }

  if (production && errors.length > 0) {
    const joined = errors.join(" | ");
    console.error(`[startup] Refusing to start in production:\n - ${joined}`);
    throw new Error(`Startup validation failed: ${joined}`);
  }

  if (warnings.length > 0) {
    console.warn(`[startup] ${warnings.join(" | ")}`);
  }
  if (errors.length > 0) {
    console.error(`[startup] ${errors.join(" | ")}`);
  }

  return { errors, warnings };
}

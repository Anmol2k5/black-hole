/**
 * Runtime configuration from environment variables.
 * All config is read once and cached for the process lifetime.
 */

import path from 'path';

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

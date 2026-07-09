/**
 * Cosine similarity search over stored embedding vectors.
 */

import { getDb } from '../db/client';

interface ChunkMatch {
  id: string;
  sourceId: string;
  content: string;
  chunkIndex: number;
  score: number;
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

/**
 * Search chunks by embedding similarity.
 * Loads all chunk embeddings from DB and computes similarity in JS.
 * For MVP this is fine; for scale, switch to pgvector or a vector DB.
 */
export function searchByEmbedding(
  queryEmbedding: number[],
  topK: number = 10,
  minScore: number = 0.3
): ChunkMatch[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT id, source_id, content, chunk_index, embedding_json
    FROM chunks
    WHERE embedding_json IS NOT NULL
  `).all() as Array<{
    id: string;
    source_id: string;
    content: string;
    chunk_index: number;
    embedding_json: string;
  }>;

  const scored: ChunkMatch[] = [];

  for (const row of rows) {
    try {
      const embedding = JSON.parse(row.embedding_json) as number[];
      const score = cosineSimilarity(queryEmbedding, embedding);
      if (score >= minScore) {
        scored.push({
          id: row.id,
          sourceId: row.source_id,
          content: row.content,
          chunkIndex: row.chunk_index,
          score,
        });
      }
    } catch {
      // Skip chunks with invalid embeddings
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/**
 * Full-text search over chunks using FTS5.
 */
export function searchChunksFTS(
  query: string,
  limit: number = 20
): Array<{ id: string; sourceId: string; content: string; chunkIndex: number }> {
  const db = getDb();

  const rows = db.prepare(`
    SELECT c.id, c.source_id, c.content, c.chunk_index
    FROM chunks_fts f
    JOIN chunks c ON c.rowid = f.rowid
    WHERE chunks_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(query, limit) as Array<{
    id: string;
    source_id: string;
    content: string;
    chunk_index: number;
  }>;

  return rows.map(r => ({
    id: r.id,
    sourceId: r.source_id,
    content: r.content,
    chunkIndex: r.chunk_index,
  }));
}

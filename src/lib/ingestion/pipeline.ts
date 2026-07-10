/**
 * Ingestion pipeline orchestrator.
 * Coordinates: save → extract text → chunk → embed → LLM extract → wiki compile → citations.
 */

import { v4 as uuid } from 'uuid';
import { getDb } from '../db/client';
import { getConfig } from '../config';
import { saveUploadedFile } from './file-storage';
import { extractText } from './text-extractor';
import { chunkText } from './chunker';
import { embedBatch } from '../embeddings/provider';
import { extractInsights } from '../extraction/llm-extractor';
import { initializeWikiPages, updateWikiFromExtraction } from '../wiki/compiler';
import { createCitationsFromExtraction } from '../citations/manager';

export interface IngestionProgress {
  sourceId: string;
  jobId: string;
  status: 'pending' | 'saving' | 'extracting' | 'chunking' | 'embedding' | 'analyzing' | 'compiling' | 'completed' | 'failed' | 'needs_ocr';
  step: string;
  error?: string;
}

/**
 * Run the full ingestion pipeline for a single file.
 */
export async function ingestFile(
  fileBuffer: Buffer,
  originalName: string,
): Promise<IngestionProgress> {
  const db = getDb();
  const jobId = uuid();

  // Create job record
  db.prepare(`
    INSERT INTO jobs (id, job_type, status, current_step, started_at)
    VALUES (?, 'ingest', 'running', 'saving', datetime('now'))
  `).run(jobId);

  let sourceId = '';

  try {
    // Ensure wiki pages exist
    initializeWikiPages();

    // Step 1: Save raw file
    updateJob(jobId, 'running', 'Saving raw file');
    sourceId = await saveUploadedFile(fileBuffer, originalName);
    db.prepare('UPDATE jobs SET source_id = ? WHERE id = ?').run(sourceId, jobId);
    updateSource(sourceId, 'extracting');

    // Step 2: Extract text
    updateJob(jobId, 'running', 'Extracting text');
    const source = db.prepare('SELECT file_path, file_type FROM sources WHERE id = ?').get(sourceId) as {
      file_path: string;
      file_type: string;
    };
    const text = await extractText(source.file_path, source.file_type);
    db.prepare('UPDATE sources SET extracted_text = ? WHERE id = ?').run(text, sourceId);

    // Step 3: Chunk text
    updateJob(jobId, 'running', 'Chunking text');
    updateSource(sourceId, 'analyzing');
    const config = getConfig();
    const chunks = chunkText(text, config.maxChunkSize, config.chunkOverlap);

    // Step 4: Generate embeddings
    updateJob(jobId, 'running', 'Generating embeddings');
    let embeddings: number[][] = [];
    try {
      embeddings = await embedBatch(chunks.map(c => c.content));
    } catch (err) {
      console.warn('Embedding generation failed, continuing without embeddings:', err);
      embeddings = chunks.map(() => []);
    }

    // Step 5: Store chunks + embeddings
    updateJob(jobId, 'running', 'Storing chunks');
    const insertChunk = db.prepare(`
      INSERT INTO chunks (id, source_id, content, chunk_index, char_start, char_end, embedding_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertChunks = db.transaction(() => {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embeddingJson = embeddings[i]?.length > 0 ? JSON.stringify(embeddings[i]) : null;
        insertChunk.run(uuid(), sourceId, chunk.content, chunk.index, chunk.charStart, chunk.charEnd, embeddingJson);
      }
    });
    insertChunks();

    // Step 6: LLM extraction
    updateJob(jobId, 'running', 'Analyzing with AI');
    updateSource(sourceId, 'analyzing');
    const extraction = await extractInsights(text, originalName);

    // Store extraction
    db.prepare(`
      INSERT INTO extractions (id, source_id, extraction_json)
      VALUES (?, ?, ?)
    `).run(uuid(), sourceId, JSON.stringify(extraction));

    // Update source metadata
    db.prepare(`
      UPDATE sources
      SET title = ?, source_type = ?, summary = ?, metadata_json = ?
      WHERE id = ?
    `).run(
      extraction.metadata.title,
      extraction.source_type,
      extraction.summary,
      JSON.stringify(extraction.metadata),
      sourceId
    );

    // Step 7: Compile wiki pages
    updateJob(jobId, 'running', 'Compiling wiki');
    updateSource(sourceId, 'compiling');
    updateWikiFromExtraction(
      sourceId,
      extraction,
      extraction.metadata.title || originalName,
      extraction.metadata.date || '',
    );

    // Step 8: Create citations
    updateJob(jobId, 'running', 'Creating citations');
    createCitationsFromExtraction(
      sourceId,
      extraction,
      extraction.metadata.title || originalName,
      extraction.metadata.date || '',
    );

    // Done!
    updateJob(jobId, 'completed', 'Done');
    updateSource(sourceId, 'completed');

    return {
      sourceId,
      jobId,
      status: 'completed',
      step: 'Done',
    };

  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const needsOcr = err instanceof Error && (err as { needsOcr?: boolean }).needsOcr === true;
    updateJob(jobId, 'failed', 'Failed', error);
    if (sourceId) updateSource(sourceId, needsOcr ? 'needs_ocr' : 'failed', error);

    return {
      sourceId,
      jobId,
      status: needsOcr ? 'needs_ocr' : 'failed',
      step: 'Failed',
      error,
    };
  }
}

function updateJob(jobId: string, status: string, step: string, error?: string): void {
  const db = getDb();
  if (status === 'completed' || status === 'failed') {
    db.prepare(`
      UPDATE jobs SET status = ?, current_step = ?, error = ?, completed_at = datetime('now') WHERE id = ?
    `).run(status, step, error || null, jobId);
  } else {
    db.prepare(`
      UPDATE jobs SET status = ?, current_step = ?, error = ? WHERE id = ?
    `).run(status, step, error || null, jobId);
  }
}

function updateSource(sourceId: string, status: string, error?: string): void {
  const db = getDb();
  if (status === 'completed') {
    db.prepare(`
      UPDATE sources SET status = ?, error = ?, processed_at = datetime('now') WHERE id = ?
    `).run(status, error || null, sourceId);
  } else {
    db.prepare(`
      UPDATE sources SET status = ?, error = ? WHERE id = ?
    `).run(status, error || null, sourceId);
  }
}

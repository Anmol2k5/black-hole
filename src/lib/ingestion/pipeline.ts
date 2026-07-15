/**
 * Ingestion pipeline orchestrator (async / job-driven).
 *
 * Upload path: validate -> save raw file -> create source -> enqueue a job.
 * Worker path: claim job -> run steps (extract, chunk, embed, analyze,
 * compile, cite) updating job progress and source status.
 *
 * Reprocessing is idempotent: prior derived rows for a source are cleared in a
 * single transaction before re-extraction, so chunks/extractions/citations are
 * never duplicated.
 */

import { v4 as uuid } from "uuid";
import { getDb } from "../db/client";
import { getConfig } from "../config";
import { saveUploadedFile } from "./file-storage";
import { extractText } from "./text-extractor";
import { chunkText } from "./chunker";
import { embedBatch } from "../embeddings/provider";
import { extractInsights } from "../extraction/llm-extractor";
import { ensureWikiPagesFromDefinitions, compileWikiFromClaims } from "../wiki/compiler-v2";
// Citations are managed dynamically.
import { storeObservationsForSource, rebuildClaims } from "../claims/repository";
import {
  enqueue,
  updateProgress,
  markCompleted,
  markFailed,
  type JobRow,
} from "../jobs/queue";

const TOTAL_STEPS = 6;

export interface EnqueuedIngestion {
  sourceId: string;
  jobId: string;
  status: "queued";
}

/**
 * Validate (caller responsibility), persist the raw file, and enqueue a job.
 * Returns immediately so the HTTP request does not block on LLM work.
 */
export async function enqueueIngestion(
  fileBuffer: Buffer,
  originalName: string,
): Promise<EnqueuedIngestion> {
  const sourceId = await saveUploadedFile(fileBuffer, originalName);
  const jobId = enqueue(sourceId, "ingest", TOTAL_STEPS);
  return { sourceId, jobId, status: "queued" };
}

/** @deprecated kept for compatibility; prefer enqueueIngestion + worker. */
export async function ingestFile(
  fileBuffer: Buffer,
  originalName: string,
): Promise<EnqueuedIngestion> {
  return enqueueIngestion(fileBuffer, originalName);
}

function setStep(jobId: string, step: string, completed: number): void {
  updateProgress(jobId, step, completed, TOTAL_STEPS, Math.round((completed / TOTAL_STEPS) * 100));
}

function setSourceStatus(sourceId: string, status: string, error?: string): void {
  const db = getDb();
  if (status === "completed") {
    db.prepare("UPDATE sources SET status = ?, error = ?, processed_at = datetime('now') WHERE id = ?").run(
      status,
      error ?? null,
      sourceId,
    );
  } else {
    db.prepare("UPDATE sources SET status = ?, error = ? WHERE id = ?").run(status, error ?? null, sourceId);
  }
}

/**
 * Process a single ingestion job. Called by the worker. Safe to re-invoke;
 * derived rows are cleared first.
 */
export async function processIngestionJob(jobId: string, sourceId: string): Promise<void> {
  const db = getDb();

  const source = db
    .prepare("SELECT file_path, file_type, original_name FROM sources WHERE id = ?")
    .get(sourceId) as { file_path: string; file_type: string; original_name: string } | undefined;

  if (!source) {
    markFailed(jobId, "Source not found");
    return;
  }

  try {
    // Idempotent reset of derived data for this source.
    const clear = db.transaction(() => {
      db.prepare("DELETE FROM chunks WHERE source_id = ?").run(sourceId);
      db.prepare("DELETE FROM extractions WHERE source_id = ?").run(sourceId);
      db.prepare("DELETE FROM citations WHERE source_id = ?").run(sourceId);
      db.prepare("DELETE FROM observations WHERE source_id = ?").run(sourceId);
    });
    clear();

    // Step 1: extract text
    setStep(jobId, "Extracting text", 1);
    setSourceStatus(sourceId, "extracting");
    const text = await extractText(source.file_path, source.file_type);
    db.prepare("UPDATE sources SET extracted_text = ? WHERE id = ?").run(text, sourceId);

    // Step 2: chunk
    setStep(jobId, "Chunking text", 2);
    setSourceStatus(sourceId, "analyzing");
    const config = getConfig();
    const rawChunks = chunkText(text, config.maxChunkSize, config.chunkOverlap);
    const chunks = rawChunks.map((c) => ({ id: uuid(), ...c }));

    // Step 3: embeddings
    setStep(jobId, "Generating embeddings", 3);
    let embeddings: number[][] = [];
    try {
      embeddings = await embedBatch(chunks.map((c) => c.content));
    } catch (err) {
      console.warn("Embedding generation failed, continuing without embeddings:", err);
      embeddings = chunks.map(() => []);
    }

    const insertChunk = db.prepare(
      "INSERT INTO chunks (id, source_id, content, chunk_index, char_start, char_end, embedding_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const insertChunks = db.transaction(() => {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embeddingJson = embeddings[i]?.length > 0 ? JSON.stringify(embeddings[i]) : null;
        insertChunk.run(chunk.id, sourceId, chunk.content, chunk.index, chunk.charStart, chunk.charEnd, embeddingJson);
      }
    });
    insertChunks();

    // Step 4: LLM extraction
    setStep(jobId, "Analyzing with AI", 4);
    setSourceStatus(sourceId, "analyzing");
    const extraction = await extractInsights(text, chunks, source.original_name);
    db.prepare("INSERT INTO extractions (id, source_id, extraction_json) VALUES (?, ?, ?)").run(
      uuid(),
      sourceId,
      JSON.stringify(extraction),
    );
    db.prepare(
      "UPDATE sources SET title = ?, source_type = ?, summary = ?, metadata_json = ? WHERE id = ?",
    ).run(
      extraction.metadata.title,
      extraction.source_type,
      extraction.summary,
      JSON.stringify(extraction.metadata),
      sourceId,
    );

    // Store chunk-level observations and rebuild normalized claims.
    if (extraction.observations && extraction.observations.length > 0) {
      storeObservationsForSource("default", sourceId, extraction.observations);
    }
    rebuildClaims("default");

    // Step 5: compile wiki from the claims layer
    setStep(jobId, "Compiling wiki", 5);
    setSourceStatus(sourceId, "compiling");
    ensureWikiPagesFromDefinitions();
    await compileWikiFromClaims("default");

    setSourceStatus(sourceId, "completed");
    markCompleted(jobId, { sourceId });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const needsOcr = err instanceof Error && (err as { needsOcr?: boolean }).needsOcr === true;
    setSourceStatus(sourceId, needsOcr ? "needs_ocr" : "failed", error);
    markFailed(jobId, error);
  }
}

export type { JobRow };

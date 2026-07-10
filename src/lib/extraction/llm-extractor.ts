/**
 * LLM-based metadata and insight extraction (Phase 9 — map/reduce).
 *
 * The document is analyzed end-to-end:
 *  - document-level metadata + summary from a leading sample
 *  - chunk-level observations extracted from every segment (no truncation)
 *  - observations merged/deduplicated and converted into the ExtractionResult
 *    shape, with the raw observations preserved for the claims layer.
 *
 * Source text is wrapped as untrusted data so document content cannot
 * commandeer the model (prompt-injection protection).
 */

import { getConfig } from "../config";
import { extractJSON } from "../llm/provider";
import { splitForExtraction } from "../ingestion/chunker";
import {
  ExtractionResultSchema,
  ObservationSchema,
  type ExtractionResultV2,
  type Observation,
} from "./schemas";
import {
  DOCUMENT_METADATA_PROMPT,
  REDUCE_PROMPT,
  wrapUntrustedSource,
} from "./prompts";
import { extractChunkObservations } from "./chunk-extractor";
import { mergeObservations, buildExtractionResult, type DocumentMeta } from "./document-reducer";

const EXTRACT_SEGMENT_CHARS = 4000;
const EXTRACT_OVERLAP_CHARS = 200;
const META_SAMPLE_CHARS = 6000;

const DOC_META_SCHEMA = ExtractionResultSchema.pick({
  summary: true,
  source_type: true,
  metadata: true,
  suggested_wiki_pages: true,
});

async function extractDocumentMeta(sample: string, filename: string): Promise<DocumentMeta> {
  const prompt = DOCUMENT_METADATA_PROMPT + `\n\nFilename: ${filename}\n\n` + wrapUntrustedSource(sample);
  try {
    const parsed = await extractJSON(prompt, (raw) => DOC_META_SCHEMA.parse(raw));
    return {
      summary: parsed.summary,
      source_type: parsed.source_type,
      metadata: parsed.metadata,
      suggested_wiki_pages: parsed.suggested_wiki_pages,
    };
  } catch (err) {
    console.warn("Document metadata extraction failed, using defaults:", err);
    return {
      summary: "",
      source_type: "other",
      metadata: {
        title: "Untitled",
        date: "",
        people: [],
        companies: [],
        product_areas: [],
        topics: [],
        sentiment: "neutral",
        urgency: "medium",
      },
      suggested_wiki_pages: [],
    };
  }
}

/**
 * Extract structured insights from a document using LLM (map-reduce).
 */
export async function extractInsights(
  text: string,
  filename: string,
): Promise<ExtractionResultV2> {
  // 1. Document-level metadata + summary (from a leading sample).
  const docMeta = await extractDocumentMeta(text.slice(0, META_SAMPLE_CHARS), filename);

  // 2. Chunk-level observations across the WHOLE document.
  const segments = splitForExtraction(text, EXTRACT_SEGMENT_CHARS, EXTRACT_OVERLAP_CHARS);
  const allObservations: Observation[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const locationHint = { sectionIndex: i, charStart: seg.charStart, charEnd: seg.charEnd };
    const obs = await extractChunkObservations(seg.content, locationHint);
    allObservations.push(...obs);
  }

  // 3. Reduce / merge.
  const reduced = await reduceObservations(allObservations);

  // 4. Build the ExtractionResult (preserves wiki-compatible `insights`).
  const config = getConfig();
  const meta = {
    extractor_version: "1.0.0",
    prompt_version: "1.0.0",
    model: config.llmModel,
    provider: config.llmProvider,
    created_at: new Date().toISOString(),
  };

  return buildExtractionResult(reduced, docMeta, meta);
}

async function reduceObservations(observations: Observation[]): Promise<Observation[]> {
  if (observations.length <= 1) return mergeObservations(observations);

  const prompt =
    REDUCE_PROMPT + "\n\n" + JSON.stringify({ observations });
  try {
    const result = await extractJSON<{ observations?: unknown[] }>(prompt, (raw) => {
      const obs = (raw as { observations?: unknown[] }).observations ?? [];
      return { observations: obs.map((o) => ObservationSchema.parse(o)) };
    });
    return mergeObservations((result.observations ?? []) as Observation[]);
  } catch (err) {
    console.warn("Observation reduce failed, using local merge:", err);
    return mergeObservations(observations);
  }
}

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
import {
  ExtractionResultSchema,
  type ExtractionResultV2,
  type Observation,
} from "./schemas";
import {
  DOCUMENT_METADATA_PROMPT,
  wrapUntrustedSource,
} from "./prompts";
import { extractChunkObservations } from "./chunk-extractor";
import { mergeObservations, buildExtractionResult, type DocumentMeta } from "./document-reducer";

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

export async function extractInsights(
  text: string,
  chunks: Array<{ id: string; content: string; charStart: number; charEnd: number }>,
  filename: string,
): Promise<ExtractionResultV2> {
  // 1. Document-level metadata + summary (from a leading sample).
  const docMeta = await extractDocumentMeta(text.slice(0, META_SAMPLE_CHARS), filename);

  // 2. Chunk-level observations across the WHOLE document.
  const allObservations: Observation[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const locationHint = { sectionIndex: i, charStart: chunk.charStart, charEnd: chunk.charEnd, chunkId: chunk.id };
    const obs = await extractChunkObservations(chunk.content, locationHint);
    
    // Attempt exact quote matching inside chunk.content to add offset metadata
    for (const o of obs) {
      if (o.quote) {
        const offset = chunk.content.indexOf(o.quote);
        if (offset >= 0) {
          o.location = {
            ...o.location,
            quoteStart: chunk.charStart + offset,
            quoteEnd: chunk.charStart + offset + o.quote.length,
          };
        } else {
          o.quote = undefined;
        }
      }
    }
    
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
  // Pass through directly to allow Claims layer to handle deduplication without discarding explicit evidence mapping.
  return mergeObservations(observations);
}

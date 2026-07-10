/**
 * Evidence registry (Phase 12.1 / 12.3).
 *
 * Maps retrieval candidates to stable evidence markers ([E1], [E2], ...) that
 * the LLM can reference. The server — not the model — owns the mapping from a
 * marker back to a real sourceId / chunkId, and populates the quote.
 */

import type { CitationEvidence } from "./validator";

export interface RetrievedChunk {
  chunkId: string;
  sourceId: string;
  content: string;
  score: number;
}

export interface EvidenceMarker extends CitationEvidence {
  id: string; // E1, E2, ...
  content: string;
}

export interface EvidenceRegistry {
  markers: EvidenceMarker[];
  byId: Map<string, EvidenceMarker>;
}

export function buildEvidenceRegistry(
  chunks: RetrievedChunk[],
  sourceMeta: Map<string, { title: string; date: string }>,
): EvidenceRegistry {
  const markers: EvidenceMarker[] = [];
  const byId = new Map<string, EvidenceMarker>();

  chunks.forEach((chunk, i) => {
    const meta = sourceMeta.get(chunk.sourceId);
    const marker: EvidenceMarker = {
      id: `E${i + 1}`,
      sourceId: chunk.sourceId,
      chunkId: chunk.chunkId,
      sourceTitle: meta?.title ?? "Untitled",
      sourceDate: meta?.date ?? "",
      quote: chunk.content,
      content: chunk.content,
    };
    markers.push(marker);
    byId.set(marker.id, marker);
  });

  return { markers, byId };
}

/** A short, server-selected snippet used as the verified quote. */
export function snippetFor(content: string, maxLen = 200): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
}

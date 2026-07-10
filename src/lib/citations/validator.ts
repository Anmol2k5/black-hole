/**
 * Citation validation (Phase 12.2 / 12.5).
 *
 * The model may only reference evidence markers that were actually retrieved.
 * Unknown markers are rejected (dropped) so an answer can never cite a
 * fabricated source.
 */

export interface CitationEvidence {
  sourceId: string;
  chunkId: string | null;
  sourceTitle: string;
  sourceDate: string;
  quote: string;
}

export class InvalidCitationError extends Error {
  constructor(public readonly invalidIds: string[]) {
    super(`Unknown evidence markers: ${invalidIds.join(", ")}`);
    this.name = "InvalidCitationError";
  }
}

/**
 * Validate the proposed evidence ids against the retrieved set.
 * Returns the valid evidence and the list of rejected (unknown) ids.
 */
export function validateEvidenceIds(
  byId: Map<string, { sourceId: string; chunkId: string | null; sourceTitle: string; sourceDate: string; content: string }>,
  proposed: string[],
): { valid: CitationEvidence[]; invalid: string[] } {
  const valid: CitationEvidence[] = [];
  const invalid: string[] = [];

  for (const id of proposed) {
    const marker = byId.get(id);
    if (!marker) {
      invalid.push(id);
      continue;
    }
    valid.push({
      sourceId: marker.sourceId,
      chunkId: marker.chunkId,
      sourceTitle: marker.sourceTitle,
      sourceDate: marker.sourceDate,
      quote: marker.content,
    });
  }

  return { valid, invalid };
}

export interface CitationCoverage {
  totalSentences: number;
  citedSentences: number;
  coverage: number;
  invalidCount: number;
}

/** Measure how much of the answer text is backed by citations. */
export function measureCoverage(answer: string, invalidCount: number): CitationCoverage {
  const sentences = answer
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const cited = sentences.filter((s) => /\[E\d+\]/.test(s)).length;
  const total = sentences.length || 1;
  return {
    totalSentences: sentences.length,
    citedSentences: cited,
    coverage: cited / total,
    invalidCount,
  };
}

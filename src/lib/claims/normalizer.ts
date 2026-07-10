/**
 * Observation normalization (Phase 10.4).
 *
 * Produces a canonical key for an observation so that near-identical signals
 * from different sources collapse into a single claim. Also provides a
 * token-overlap similarity used for fuzzy clustering.
 */

export function canonicalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): Set<string> {
  return new Set(canonicalizeText(text).split(" ").filter((t) => t.length > 2));
}

/** Jaccard similarity between two token sets (0..1). */
export function tokenSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection += 1;
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

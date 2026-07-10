/**
 * Document reducer (Phase 9.1).
 *
 * Merges chunk-level observations into a deduplicated set and converts them
 * into the ExtractionResult shape consumed by the wiki compiler, while also
 * preserving the raw observations for the claims layer.
 */

import {
  ObservationSchema,
  type Observation,
  type ExtractionResult,
  type ExtractionResultV2,
  type ExtractionMeta,
  type InsightItem,
  OBSERVATION_TYPES,
  type ObservationType,
} from "./schemas";

const SEVERITY_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/** Deduplicate observations that refer to the same signal. */
export function mergeObservations(observations: Observation[]): Observation[] {
  const byKey = new Map<string, Observation>();

  for (const obs of observations) {
    const key = `${obs.type}::${normalize(obs.text)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, obs);
      continue;
    }
    // Keep the stronger of the two.
    const best =
      SEVERITY_RANK[obs.severity] > SEVERITY_RANK[existing.severity] ? obs : existing;
    const merged: Observation = {
      ...best,
      confidence: Math.max(obs.confidence, existing.confidence),
      quote: best.quote || obs.quote,
      entityNames: Array.from(new Set([...best.entityNames, ...obs.entityNames])),
    };
    byKey.set(key, ObservationSchema.parse(merged));
  }

  return [...byKey.values()];
}

const INSIGHT_KEY: Record<ObservationType, string> = {
  pain_point: "pain_points",
  feature_request: "feature_requests",
  bug: "bugs",
  sales_objection: "sales_objections",
  pricing_feedback: "pricing_feedback",
  competitor_mention: "competitor_mentions",
  positive_feedback: "positive_feedback",
  negative_feedback: "negative_feedback",
  decision: "decisions",
  question: "open_questions",
};

export interface DocumentMeta {
  summary: string;
  source_type: ExtractionResult["source_type"];
  metadata: ExtractionResult["metadata"];
  suggested_wiki_pages: string[];
}

export function buildExtractionResult(
  observations: Observation[],
  docMeta: DocumentMeta,
  meta: ExtractionMeta,
): ExtractionResultV2 {
  const insights: Record<string, unknown> = {
    pain_points: [],
    feature_requests: [],
    bugs: [],
    sales_objections: [],
    pricing_feedback: [],
    competitor_mentions: [],
    positive_feedback: [],
    negative_feedback: [],
    decisions: [],
    direct_quotes: [],
    open_questions: [],
  };

  for (const obs of observations) {
    const key = INSIGHT_KEY[obs.type];
    if (obs.type === "question") {
      (insights.open_questions as string[]).push(obs.text);
      continue;
    }
    const item: InsightItem = {
      text: obs.text,
      context: obs.location?.sectionTitle ?? "",
      source_quote: obs.quote ?? "",
      severity: obs.severity,
    };
    (insights[key] as InsightItem[]).push(item);
    if (obs.quote) {
      (insights.direct_quotes as Array<{ quote: string; speaker?: string; context?: string }>).push({
        quote: obs.quote,
        speaker: obs.location?.speaker,
        context: obs.location?.sectionTitle ?? "",
      });
    }
  }

  return {
    summary: docMeta.summary,
    source_type: docMeta.source_type,
    metadata: docMeta.metadata,
    insights: insights as ExtractionResult["insights"],
    suggested_wiki_pages: docMeta.suggested_wiki_pages,
    observations,
    extraction_meta: meta,
  };
}

export { OBSERVATION_TYPES };

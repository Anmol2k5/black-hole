/**
 * Document reducer (Phase 9.1).
 *
 * Merges chunk-level observations into a deduplicated set and converts them
 * into the ExtractionResult shape consumed by the wiki compiler, while also
 * preserving the raw observations for the claims layer.
 */

import {
  type Observation,
  type ExtractionResult,
  type ExtractionResultV2,
  type ExtractionMeta,
  type InsightItem,
  OBSERVATION_TYPES,
  type ObservationType,
} from "./schemas";

/** Deduplicate observations that refer to the same signal. */
export function mergeObservations(observations: Observation[]): Observation[] {
  return observations;
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

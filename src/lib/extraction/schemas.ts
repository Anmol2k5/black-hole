/**
 * Zod schemas for LLM extraction output.
 */

import { z } from 'zod';

export const InsightItemSchema = z.object({
  text: z.string(),
  context: z.string().optional().default(''),
  source_quote: z.string().optional().default(''),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
});

export type InsightItem = z.infer<typeof InsightItemSchema>;

export const ExtractionResultSchema = z.object({
  summary: z.string(),
  source_type: z.enum([
    'customer_call', 'meeting_notes', 'support_ticket',
    'sales_notes', 'product_doc', 'internal_memo',
    'feedback_form', 'slack_export', 'founder_notes', 'other'
  ]).default('other'),
  metadata: z.object({
    title: z.string().default('Untitled'),
    date: z.string().optional().default(''),
    people: z.array(z.string()).default([]),
    companies: z.array(z.string()).default([]),
    product_areas: z.array(z.string()).default([]),
    topics: z.array(z.string()).default([]),
    sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']).default('neutral'),
    urgency: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  }),
  insights: z.object({
    pain_points: z.array(InsightItemSchema).default([]),
    feature_requests: z.array(InsightItemSchema).default([]),
    bugs: z.array(InsightItemSchema).default([]),
    sales_objections: z.array(InsightItemSchema).default([]),
    pricing_feedback: z.array(InsightItemSchema).default([]),
    competitor_mentions: z.array(InsightItemSchema).default([]),
    positive_feedback: z.array(InsightItemSchema).default([]),
    negative_feedback: z.array(InsightItemSchema).default([]),
    decisions: z.array(InsightItemSchema).default([]),
    direct_quotes: z.array(z.object({
      quote: z.string(),
      speaker: z.string().optional().default(''),
      context: z.string().optional().default(''),
    })).default([]),
    open_questions: z.array(z.string()).default([]),
  }),
  suggested_wiki_pages: z.array(z.string()).default([]),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ---------------------------------------------------------------------------
// Chunk-level observation extraction (Phase 9)
// ---------------------------------------------------------------------------

export const OBSERVATION_TYPES = [
  "pain_point",
  "feature_request",
  "bug",
  "sales_objection",
  "pricing_feedback",
  "competitor_mention",
  "positive_feedback",
  "negative_feedback",
  "decision",
  "question",
] as const;

export type ObservationType = (typeof OBSERVATION_TYPES)[number];

export const ChunkLocationSchema = z.object({
  pageNumber: z.number().optional(),
  rowStart: z.number().optional(),
  rowEnd: z.number().optional(),
  charStart: z.number().optional(),
  charEnd: z.number().optional(),
  timestampStart: z.number().optional(),
  timestampEnd: z.number().optional(),
  speaker: z.string().optional(),
  sectionTitle: z.string().optional(),
});

export type ChunkLocation = z.infer<typeof ChunkLocationSchema>;

export const ObservationSchema = z.object({
  type: z.enum(OBSERVATION_TYPES),
  text: z.string().min(1),
  quote: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  entityNames: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  location: ChunkLocationSchema.optional(),
});

export type Observation = z.infer<typeof ObservationSchema>;

export const ExtractionMetaSchema = z.object({
  extractor_version: z.string().default("1.0.0"),
  prompt_version: z.string().default("1.0.0"),
  model: z.string().default(""),
  provider: z.string().default("openai-compatible"),
  created_at: z.string().default(""),
});

export type ExtractionMeta = z.infer<typeof ExtractionMetaSchema>;

// Extend ExtractionResult to optionally carry chunk-level observations and
// extraction metadata, without breaking the legacy `insights` contract used
// by the wiki compiler.
export const ExtractionResultSchemaV2 = ExtractionResultSchema.extend({
  observations: z.array(ObservationSchema).default([]),
  extraction_meta: ExtractionMetaSchema.optional(),
});

export type ExtractionResultV2 = z.infer<typeof ExtractionResultSchemaV2>;

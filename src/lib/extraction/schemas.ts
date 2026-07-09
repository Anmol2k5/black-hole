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

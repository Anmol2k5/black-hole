/**
 * LLM-based metadata and insight extraction.
 * Sends source text to LLM and extracts structured insights.
 */

import { extractJSON } from '../llm/provider';
import { ExtractionResultSchema, type ExtractionResult } from './schemas';

const EXTRACTION_PROMPT = `Analyze the following document and extract structured insights.

The document may be a customer call transcript, meeting notes, support ticket, sales notes, or internal document.

Extract ALL of the following. Be thorough. Include direct quotes where available.

Return a JSON object with this exact structure:
{
  "summary": "2-3 sentence summary of the document",
  "source_type": "customer_call|meeting_notes|support_ticket|sales_notes|product_doc|internal_memo|feedback_form|slack_export|founder_notes|other",
  "metadata": {
    "title": "descriptive title for this document",
    "date": "date mentioned in the document (ISO format) or empty string",
    "people": ["names of people mentioned"],
    "companies": ["company names mentioned"],
    "product_areas": ["product areas or features discussed"],
    "topics": ["key topics covered"],
    "sentiment": "positive|neutral|negative|mixed",
    "urgency": "low|medium|high|critical"
  },
  "insights": {
    "pain_points": [{"text": "description", "context": "where in doc", "source_quote": "exact quote", "severity": "low|medium|high|critical"}],
    "feature_requests": [{"text": "feature description", "context": "", "source_quote": "exact quote", "severity": "medium"}],
    "bugs": [{"text": "bug description", "context": "", "source_quote": "", "severity": "medium"}],
    "sales_objections": [{"text": "objection", "context": "", "source_quote": "", "severity": "medium"}],
    "pricing_feedback": [{"text": "feedback", "context": "", "source_quote": "", "severity": "medium"}],
    "competitor_mentions": [{"text": "competitor name and context", "context": "", "source_quote": "", "severity": "medium"}],
    "positive_feedback": [{"text": "positive feedback", "context": "", "source_quote": "", "severity": "medium"}],
    "negative_feedback": [{"text": "negative feedback", "context": "", "source_quote": "", "severity": "medium"}],
    "decisions": [{"text": "decision made", "context": "", "source_quote": "", "severity": "medium"}],
    "direct_quotes": [{"quote": "exact quote worth preserving", "speaker": "who said it", "context": "context"}],
    "open_questions": ["unanswered questions from the document"]
  },
  "suggested_wiki_pages": ["product/requested-features", "sales/pricing-objections"]
}

Only include items that are actually present in the document. Do not invent data.
Use empty arrays for categories with no relevant content.

DOCUMENT:
`;

/**
 * Extract structured insights from a document using LLM.
 */
export async function extractInsights(
  text: string,
  filename: string
): Promise<ExtractionResult> {
  const truncatedText = text.slice(0, 15000); // Limit to ~15K chars for API limits

  const prompt = EXTRACTION_PROMPT + `\nFilename: ${filename}\n\n${truncatedText}`;

  return extractJSON<ExtractionResult>(prompt, (raw) => {
    return ExtractionResultSchema.parse(raw);
  });
}

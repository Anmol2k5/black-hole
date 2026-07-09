/**
 * Citation manager — tracks source→claim→wiki page relationships.
 */

import { v4 as uuid } from 'uuid';
import { getDb } from '../db/client';
import type { ExtractionResult, InsightItem } from '../extraction/schemas';

export interface Citation {
  id: string;
  wikiPageId: string;
  sourceId: string;
  chunkId?: string;
  claimText: string;
  quote?: string;
  sourceTitle?: string;
  sourceDate?: string;
}

/**
 * Create citations linking a source's extracted insights to wiki pages.
 */
export function createCitationsFromExtraction(
  sourceId: string,
  extraction: ExtractionResult,
  sourceTitle: string,
  sourceDate: string,
): void {
  const db = getDb();

  // Get all wiki pages
  const pages = db.prepare('SELECT id, slug FROM wiki_pages').all() as Array<{ id: string; slug: string }>;
  const slugToId = new Map(pages.map(p => [p.slug, p.id]));

  // Map insight keys to wiki page slugs
  const insightToPages: Record<string, string[]> = {
    pain_points: ['strategy/customer-pain-points', 'support/repeated-complaints', 'product/roadmap-evidence'],
    feature_requests: ['product/requested-features', 'product/roadmap-evidence'],
    bugs: ['product/known-bugs', 'support/repeated-complaints'],
    sales_objections: ['sales/pricing-objections', 'sales/lost-deal-reasons'],
    pricing_feedback: ['sales/pricing-objections'],
    competitor_mentions: ['sales/competitor-mentions', 'sales/lost-deal-reasons'],
    positive_feedback: ['product/onboarding-feedback', 'synthesis/top-insights'],
    negative_feedback: ['support/repeated-complaints', 'product/onboarding-feedback'],
    decisions: ['synthesis/top-insights'],
  };

  const insert = db.prepare(`
    INSERT INTO citations (id, wiki_page_id, source_id, claim_text, quote, source_title, source_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: Array<{ pageId: string; claim: string; quote: string }>) => {
    for (const item of items) {
      insert.run(uuid(), item.pageId, sourceId, item.claim, item.quote, sourceTitle, sourceDate);
    }
  });

  const citationItems: Array<{ pageId: string; claim: string; quote: string }> = [];

  for (const [key, pageSlugs] of Object.entries(insightToPages)) {
    const items = (extraction.insights as unknown as Record<string, InsightItem[]>)[key] || [];
    for (const item of items) {
      for (const slug of pageSlugs) {
        const pageId = slugToId.get(slug);
        if (pageId) {
          citationItems.push({
            pageId,
            claim: item.text,
            quote: item.source_quote || '',
          });
        }
      }
    }
  }

  if (citationItems.length > 0) {
    insertMany(citationItems);
  }
}

/**
 * Get all citations for a wiki page.
 */
export function getCitationsForPage(wikiPageId: string): Citation[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, wiki_page_id, source_id, chunk_id, claim_text, quote, source_title, source_date
    FROM citations
    WHERE wiki_page_id = ?
    ORDER BY created_at DESC
  `).all(wikiPageId) as Citation[];
}

/**
 * Get all wiki pages that cite a specific source.
 */
export function getPagesCitingSource(sourceId: string): string[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT DISTINCT wp.slug
    FROM citations c
    JOIN wiki_pages wp ON wp.id = c.wiki_page_id
    WHERE c.source_id = ?
  `).all(sourceId) as Array<{ slug: string }>;
  return rows.map(r => r.slug);
}

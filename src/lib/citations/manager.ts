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

import { wikiPageDefinitions } from '../wiki/definitions';

/**
 * Get all citations for a wiki page.
 */
export function getCitationsForPage(wikiPageId: string): Citation[] {
  const db = getDb();
  const page = db.prepare('SELECT slug, is_generated FROM wiki_pages WHERE id = ?').get(wikiPageId) as { slug: string; is_generated: number };
  if (!page) return [];

  if (page.is_generated === 1) {
    const def = wikiPageDefinitions.find(d => d.slug === page.slug);
    if (!def || def.claimTypes.length === 0) return [];

    const typesIn = def.claimTypes.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT DISTINCT 
        s.id as source_id, 
        s.title as source_title, 
        s.metadata_json,
        o.quote as quote,
        c.canonical_text,
        o.chunk_id
      FROM claims c
      JOIN claim_evidence ce ON ce.claim_id = c.id
      JOIN observations o ON o.id = ce.observation_id
      JOIN sources s ON s.id = o.source_id
      WHERE c.type IN (${typesIn}) AND c.unique_source_count >= ?
    `).all(...def.claimTypes, def.minimumEvidence) as Array<{
      source_id: string;
      source_title: string;
      metadata_json: string | null;
      quote: string | null;
      canonical_text: string;
      chunk_id: string | null;
    }>;

    return rows.map((r, i) => {
      let date = '';
      try {
        if (r.metadata_json) {
          date = JSON.parse(r.metadata_json).date || '';
        }
      } catch {}
      return {
        id: `dyn-${i}`,
        wikiPageId: wikiPageId,
        sourceId: r.source_id,
        chunkId: r.chunk_id || undefined,
        claimText: r.canonical_text,
        quote: r.quote || undefined,
        sourceTitle: r.source_title || 'Untitled',
        sourceDate: date,
      };
    });
  } else {
    const rows = db.prepare(`
      SELECT id, wiki_page_id as wikiPageId, source_id as sourceId, chunk_id as chunkId, claim_text as claimText, quote, source_title as sourceTitle, source_date as sourceDate
      FROM citations
      WHERE wiki_page_id = ?
      ORDER BY created_at DESC
    `).all(wikiPageId) as any[];
    
    return rows.map(r => ({
      ...r,
      chunkId: r.chunkId || undefined,
      quote: r.quote || undefined,
      sourceTitle: r.sourceTitle || undefined,
      sourceDate: r.sourceDate || undefined,
    }));
  }
}

/**
 * Get all wiki pages that cite a specific source.
 */
export function getPagesCitingSource(sourceId: string): string[] {
  const db = getDb();
  const explicit = db.prepare(`
    SELECT DISTINCT wp.slug
    FROM citations c
    JOIN wiki_pages wp ON wp.id = c.wiki_page_id
    WHERE c.source_id = ?
  `).all(sourceId) as Array<{ slug: string }>;

  const claimTypes = db.prepare(`
    SELECT DISTINCT c.type, c.unique_source_count
    FROM claims c
    JOIN claim_evidence ce ON ce.claim_id = c.id
    JOIN observations o ON o.id = ce.observation_id
    WHERE o.source_id = ?
  `).all(sourceId) as Array<{ type: string; unique_source_count: number }>;

  const slugs = new Set(explicit.map(r => r.slug));

  for (const ct of claimTypes) {
    for (const def of wikiPageDefinitions) {
      if (def.claimTypes.includes(ct.type) && ct.unique_source_count >= def.minimumEvidence) {
        slugs.add(def.slug);
      }
    }
  }

  return Array.from(slugs);
}

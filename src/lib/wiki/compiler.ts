/**
 * Wiki compiler — generates and updates wiki pages from extraction results.
 */

import { v4 as uuid } from 'uuid';
import fs from 'fs';
import { getDb } from '../db/client';
import { dataPath } from '../config';
import { WIKI_TEMPLATES, renderWikiPage, renderIndexPage } from './templates';
import type { ExtractionResult, InsightItem } from '../extraction/schemas';

interface AggregatedInsight {
  text: string;
  sourceQuote: string;
  sourceTitle: string;
  sourceDate: string;
  severity: string;
}

/**
 * Initialize all default wiki pages if they don't exist.
 */
export function initializeWikiPages(): void {
  const db = getDb();

  for (const template of WIKI_TEMPLATES) {
    const existing = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?').get(template.slug);
    if (!existing) {
      const id = uuid();
      const content = renderWikiPage(template, [], 0);

      // Save to DB
      db.prepare(`
        INSERT INTO wiki_pages (id, slug, title, category, content_md, source_count, confidence)
        VALUES (?, ?, ?, ?, ?, 0, 'low')
      `).run(id, template.slug, template.title, template.category, content);

      // Save to disk
      const filePath = dataPath('wiki', ...template.slug.split('/'));
      const dir = filePath.replace(/[^/\\]+$/, '');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath + '.md', content, 'utf-8');
    }
  }

  // Create index page
  updateIndexPage();
}

/**
 * Update wiki pages based on a new extraction result.
 */
export function updateWikiFromExtraction(
  sourceId: string,
  extraction: ExtractionResult,
  sourceTitle: string,
  sourceDate: string,
): void {
  const db = getDb();

  for (const template of WIKI_TEMPLATES) {
    // Collect relevant insights for this template
    const allInsights: AggregatedInsight[] = [];

    for (const key of template.insightKeys) {
      if (key === 'open_questions') {
        // Open questions are just strings
        const questions = extraction.insights.open_questions || [];
        for (const q of questions) {
          allInsights.push({
            text: q,
            sourceQuote: '',
            sourceTitle,
            sourceDate,
            severity: 'medium',
          });
        }
      } else {
        const items = (extraction.insights as unknown as Record<string, InsightItem[]>)[key] || [];
        for (const item of items) {
          allInsights.push({
            text: item.text,
            sourceQuote: item.source_quote || '',
            sourceTitle,
            sourceDate,
            severity: item.severity || 'medium',
          });
        }
      }
    }

    if (allInsights.length === 0) continue;

    // Get existing page
    const page = db.prepare('SELECT * FROM wiki_pages WHERE slug = ?').get(template.slug) as {
      id: string;
      sources_json: string;
      source_count: number;
    } | undefined;

    if (!page) continue;

    // Merge source IDs
    let existingSources: string[] = [];
    try {
      existingSources = JSON.parse(page.sources_json || '[]');
    } catch { /* empty */ }
    if (!existingSources.includes(sourceId)) {
      existingSources.push(sourceId);
    }

    // Get ALL insights for this page (from all sources)
    const allSourceInsights = getAggregatedInsightsForPage(template.slug, template.insightKeys);

    // Render updated page
    const content = renderWikiPage(template, allSourceInsights, existingSources.length);

    // Determine confidence based on source count
    const confidence = existingSources.length >= 5 ? 'high' : existingSources.length >= 2 ? 'medium' : 'low';

    // Update DB
    db.prepare(`
      UPDATE wiki_pages
      SET content_md = ?, sources_json = ?, source_count = ?, confidence = ?, updated_at = datetime('now')
      WHERE slug = ?
    `).run(content, JSON.stringify(existingSources), existingSources.length, confidence, template.slug);

    // Update disk
    const filePath = dataPath('wiki', ...template.slug.split('/'));
    const dir = filePath.replace(/[^/\\]+$/, '');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath + '.md', content, 'utf-8');
  }

  // Update index
  updateIndexPage();
}

/**
 * Get aggregated insights for a wiki page from all source extractions.
 */
function getAggregatedInsightsForPage(
  _slug: string,
  insightKeys: string[]
): AggregatedInsight[] {
  const db = getDb();
  const allExtractions = db.prepare(`
    SELECT e.extraction_json, s.title, s.metadata_json, s.original_name
    FROM extractions e
    JOIN sources s ON s.id = e.source_id
    WHERE s.status = 'completed'
  `).all() as Array<{
    extraction_json: string;
    title: string;
    metadata_json: string;
    original_name: string;
  }>;

  const insights: AggregatedInsight[] = [];

  for (const row of allExtractions) {
    let extraction: ExtractionResult;
    try {
      extraction = JSON.parse(row.extraction_json);
    } catch { continue; }

    const sourceTitle = row.title || extraction.metadata?.title || row.original_name;
    const sourceDate = extraction.metadata?.date || '';

    for (const key of insightKeys) {
      if (key === 'open_questions') {
        const questions = extraction.insights?.open_questions || [];
        for (const q of questions) {
          insights.push({ text: q, sourceQuote: '', sourceTitle, sourceDate, severity: 'medium' });
        }
      } else {
        const items = (extraction.insights as unknown as Record<string, InsightItem[]>)?.[key] || [];
        for (const item of items) {
          insights.push({
            text: item.text,
            sourceQuote: item.source_quote || '',
            sourceTitle,
            sourceDate,
            severity: item.severity || 'medium',
          });
        }
      }
    }
  }

  // Deduplicate by similar text (simple approach)
  const seen = new Set<string>();
  return insights.filter(i => {
    const key = i.text.toLowerCase().trim().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Update the wiki index page.
 */
export function updateIndexPage(): void {
  const db = getDb();

  const pages = db.prepare(`
    SELECT slug, title, category, source_count, updated_at
    FROM wiki_pages
    ORDER BY category, title
  `).all() as Array<{
    slug: string;
    title: string;
    category: string;
    source_count: number;
    updated_at: string;
  }>;

  const indexContent = renderIndexPage(
    pages.map(p => ({
      slug: p.slug,
      title: p.title,
      category: p.category,
      sourceCount: p.source_count,
      updatedAt: p.updated_at?.split('T')[0] || 'never',
    }))
  );

  // Save index to disk
  const indexPath = dataPath('wiki', 'index.md');
  fs.mkdirSync(dataPath('wiki'), { recursive: true });
  fs.writeFileSync(indexPath, indexContent, 'utf-8');
}

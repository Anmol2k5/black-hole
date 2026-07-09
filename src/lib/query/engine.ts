/**
 * Query engine — search wiki + chunks, generate cited answers.
 */

import { getDb } from '../db/client';
import { chatCompletion } from '../llm/provider';
import { embed } from '../embeddings/provider';
import { searchByEmbedding, searchChunksFTS } from '../embeddings/similarity';

export interface Evidence {
  sourceTitle: string;
  sourceDate: string;
  quote: string;
  sourceId: string;
  type: 'wiki' | 'chunk';
}

export interface AnswerResult {
  answer: string;
  evidence: Evidence[];
  confidence: 'high' | 'medium' | 'low';
  gaps: string;
  suggestedAction: string;
  sourcesUsed: number;
  dateRange: string;
}

/**
 * Answer a question using the compiled wiki and raw chunks.
 */
export async function answerQuestion(question: string): Promise<AnswerResult> {
  const db = getDb();

  // Step 1: Search wiki pages (FTS5)
  const wikiMatches = searchWikiPages(question);

  // Step 2: Search chunks by embedding similarity
  let chunkMatches: Array<{ content: string; sourceId: string; score: number }> = [];
  try {
    const queryEmbedding = await embed(question);
    const embeddingResults = searchByEmbedding(queryEmbedding, 10, 0.25);
    chunkMatches = embeddingResults.map(r => ({
      content: r.content,
      sourceId: r.sourceId,
      score: r.score,
    }));
  } catch {
    // Fall back to FTS if embedding fails
    const ftsResults = searchChunksFTS(question.split(/\s+/).join(' OR '), 10);
    chunkMatches = ftsResults.map(r => ({
      content: r.content,
      sourceId: r.sourceId,
      score: 0.5,
    }));
  }

  // Step 3: Get source metadata for citations
  const sourceIds = new Set([
    ...chunkMatches.map(c => c.sourceId),
  ]);
  const sourceMap = new Map<string, { title: string; date: string }>();
  for (const sid of sourceIds) {
    const src = db.prepare('SELECT title, original_name, metadata_json FROM sources WHERE id = ?').get(sid) as {
      title: string;
      original_name: string;
      metadata_json: string;
    } | undefined;
    if (src) {
      let date = '';
      try {
        const meta = JSON.parse(src.metadata_json || '{}');
        date = meta.date || '';
      } catch { /* empty */ }
      sourceMap.set(sid, { title: src.title || src.original_name, date });
    }
  }

  // Step 4: Build context for LLM
  let context = '';

  if (wikiMatches.length > 0) {
    context += '=== COMPILED WIKI KNOWLEDGE ===\n\n';
    for (const wiki of wikiMatches.slice(0, 5)) {
      context += `--- Wiki Page: ${wiki.title} ---\n${wiki.content.slice(0, 2000)}\n\n`;
    }
  }

  if (chunkMatches.length > 0) {
    context += '=== RAW SOURCE EVIDENCE ===\n\n';
    for (const chunk of chunkMatches.slice(0, 10)) {
      const source = sourceMap.get(chunk.sourceId);
      const label = source ? `${source.title} (${source.date || 'undated'})` : 'Unknown source';
      context += `--- Source: ${label} ---\n${chunk.content}\n\n`;
    }
  }

  if (!context) {
    return {
      answer: 'Not enough evidence to answer this question. Please upload more sources related to this topic.',
      evidence: [],
      confidence: 'low',
      gaps: 'No relevant sources found in the knowledge base.',
      suggestedAction: 'Upload documents related to this question.',
      sourcesUsed: 0,
      dateRange: '',
    };
  }

  // Step 5: Generate answer with LLM
  const systemPrompt = `You are a company knowledge analyst. Answer the user's question ONLY based on the provided evidence.

Rules:
1. Answer only from the evidence provided. Never invent facts.
2. Include specific citations with source names and quotes.
3. Rate your confidence: "high" (strong evidence from multiple sources), "medium" (some evidence), "low" (weak or single-source evidence).
4. Note any gaps — what evidence is missing.
5. Suggest a concrete next action.
6. If evidence is contradictory, mention the contradiction.
7. If there's not enough evidence, say so clearly.

Respond in this exact JSON format:
{
  "answer": "Clear, direct answer to the question",
  "evidence": [
    {"sourceTitle": "Source Name", "sourceDate": "2025-06-15", "quote": "relevant quote or summary from that source"}
  ],
  "confidence": "high|medium|low",
  "gaps": "What we don't know yet or what evidence is missing",
  "suggestedAction": "What the company should do next based on this evidence"
}`;

  const response = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `CONTEXT:\n${context}\n\nQUESTION: ${question}` },
    ],
    { responseFormat: 'json', temperature: 0.2, maxTokens: 4096 }
  );

  try {
    const parsed = JSON.parse(response.content);

    // Map evidence to proper format
    const evidence: Evidence[] = (parsed.evidence || []).map((e: { sourceTitle: string; sourceDate?: string; quote: string }) => ({
      sourceTitle: e.sourceTitle || 'Unknown',
      sourceDate: e.sourceDate || '',
      quote: e.quote || '',
      sourceId: '',
      type: 'chunk' as const,
    }));

    // Calculate date range
    const dates = evidence.map(e => e.sourceDate).filter(Boolean).sort();
    const dateRange = dates.length >= 2 ? `${dates[0]} to ${dates[dates.length - 1]}` : dates[0] || '';

    return {
      answer: parsed.answer || 'Unable to generate answer.',
      evidence,
      confidence: parsed.confidence || 'low',
      gaps: parsed.gaps || '',
      suggestedAction: parsed.suggestedAction || '',
      sourcesUsed: sourceIds.size + wikiMatches.length,
      dateRange,
    };
  } catch {
    return {
      answer: response.content,
      evidence: [],
      confidence: 'low',
      gaps: 'Response could not be structured.',
      suggestedAction: '',
      sourcesUsed: 0,
      dateRange: '',
    };
  }
}

/**
 * Search wiki pages using FTS5.
 */
function searchWikiPages(query: string): Array<{ slug: string; title: string; content: string }> {
  const db = getDb();

  try {
    // Try FTS search first
    const ftsQuery = query.split(/\s+/).filter(w => w.length > 2).join(' OR ');
    if (!ftsQuery) return [];

    return db.prepare(`
      SELECT wp.slug, wp.title, wp.content_md as content
      FROM wiki_pages_fts f
      JOIN wiki_pages wp ON wp.rowid = f.rowid
      WHERE wiki_pages_fts MATCH ?
      ORDER BY rank
      LIMIT 5
    `).all(ftsQuery) as Array<{ slug: string; title: string; content: string }>;
  } catch {
    // Fallback: LIKE search
    const likeQuery = `%${query}%`;
    return db.prepare(`
      SELECT slug, title, content_md as content
      FROM wiki_pages
      WHERE content_md LIKE ? OR title LIKE ?
      LIMIT 5
    `).all(likeQuery, likeQuery) as Array<{ slug: string; title: string; content: string }>;
  }
}

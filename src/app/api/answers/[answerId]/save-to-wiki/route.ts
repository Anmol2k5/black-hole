import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db/client';

const ORG = 'default';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ answerId: string }> },
) {
  try {
    const { answerId } = await params;
    const db = getDb();

    const answer = db
      .prepare(
        `SELECT id, question, answer_text, evidence_json, confidence, gaps, suggested_action, sources_used_json, saved_to_wiki, wiki_page_slug
         FROM answers WHERE id = ? AND org_id = ?`,
      )
      .get(answerId, ORG) as
      | {
          id: string;
          question: string;
          answer_text: string;
          evidence_json: string | null;
          confidence: string;
          gaps: string | null;
          suggested_action: string | null;
          sources_used_json: string | null;
          saved_to_wiki: number;
          wiki_page_slug: string | null;
        }
      | undefined;

    if (!answer) {
      return NextResponse.json({ error: 'Answer not found' }, { status: 404 });
    }

    if (answer.saved_to_wiki === 1 && answer.wiki_page_slug) {
      return NextResponse.json({
        slug: answer.wiki_page_slug,
        url: `/wiki/${answer.wiki_page_slug}`,
        alreadySaved: true,
      });
    }

    // Build a unique slug.
    let slug = `synthesis/${slugify(answer.question) || 'answer'}`;
    let suffix = 2;
    while (db.prepare('SELECT 1 FROM wiki_pages WHERE slug = ?').get(slug)) {
      slug = `synthesis/${slugify(answer.question) || 'answer'}-${suffix}`;
      suffix += 1;
    }

    const title = answer.question.slice(0, 80);
    const evidence = answer.evidence_json ? JSON.parse(answer.evidence_json) : [];
    const sourcesUsed = answer.sources_used_json
      ? JSON.parse(answer.sources_used_json)
      : [];

    const evidenceLines = (evidence as Array<Record<string, string>>)
      .filter((e) => e.quote || e.sourceTitle)
      .map((e) => `- ${e.quote ? `“${e.quote}”` : ''} — ${e.sourceTitle ?? ''}${e.sourceDate ? ` (${e.sourceDate})` : ''}`)
      .join('\n');

    const contentMd = [
      `# ${title}`,
      '',
      '> Saved synthesis from an Ask query.',
      '',
      '## Answer',
      answer.answer_text,
      '',
      '## Confidence',
      answer.confidence,
      '',
      evidenceLines ? '## Evidence\n' + evidenceLines : '## Evidence\n_No linked evidence._',
      '',
      '## Gaps',
      answer.gaps || '_None noted._',
      '',
      '## Suggested Action',
      answer.suggested_action || '_None._',
      '',
    ].join('\n');

    const pageId = uuid();
    db.prepare(
      `INSERT INTO wiki_pages (id, org_id, slug, title, category, content_md, sources_json, source_count, confidence, is_generated)
       VALUES (?, ?, ?, ?, 'synthesis', ?, ?, ?, ?, 0)`,
    ).run(
      pageId,
      ORG,
      slug,
      title,
      contentMd,
      JSON.stringify(sourcesUsed),
      sourcesUsed.length,
      answer.confidence,
    );

    // Link evidence as citations (only when a real sourceId is present).
    const insertCitation = db.prepare(
      `INSERT INTO citations (id, org_id, wiki_page_id, source_id, chunk_id, claim_text, quote, source_title, source_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertCitations = db.transaction(() => {
      for (const e of evidence as Array<Record<string, string>>) {
        if (!e.sourceId) continue;
        insertCitation.run(
          uuid(),
          ORG,
          pageId,
          e.sourceId,
          e.chunkId ?? null,
          (answer.answer_text || '').slice(0, 200),
          e.quote ?? null,
          e.sourceTitle ?? null,
          e.sourceDate ?? null,
        );
      }
    });
    insertCitations();

    db.prepare(
      `UPDATE answers SET saved_to_wiki = 1, wiki_page_slug = ? WHERE id = ?`,
    ).run(slug, answerId);

    return NextResponse.json({ slug, url: `/wiki/${slug}`, alreadySaved: false });
  } catch (err) {
    console.error('Save to wiki error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save to wiki' },
      { status: 500 },
    );
  }
}

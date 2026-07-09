import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { getCitationsForPage } from '@/lib/citations/manager';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const db = getDb();

    if (slug) {
      // Get specific page
      const page = db.prepare(`
        SELECT id, slug, title, category, content_md, source_count, confidence, updated_at
        FROM wiki_pages
        WHERE slug = ?
      `).get(slug) as any;

      if (!page) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 });
      }

      const citations = getCitationsForPage(page.id);
      return NextResponse.json({ page, citations });
    }

    // Get all pages
    const pages = db.prepare(`
      SELECT id, slug, title, category, source_count, confidence, updated_at
      FROM wiki_pages
      ORDER BY category, title
    `).all();

    return NextResponse.json({ pages });
  } catch (err) {
    console.error('Fetch wiki error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch wiki' },
      { status: 500 }
    );
  }
}

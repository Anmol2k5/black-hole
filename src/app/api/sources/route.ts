import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';

export async function GET() {
  try {
    const db = getDb();
    const sources = db.prepare(`
      SELECT id, filename, original_name, file_type, category, source_type, file_size, status, error, title, summary, metadata_json, uploaded_at, processed_at
      FROM sources
      ORDER BY uploaded_at DESC
    `).all();

    return NextResponse.json({ sources });
  } catch (err) {
    console.error('Fetch sources error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch sources' },
      { status: 500 }
    );
  }
}

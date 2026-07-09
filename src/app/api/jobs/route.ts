import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';

export async function GET() {
  try {
    const db = getDb();
    const jobs = db.prepare(`
      SELECT j.id, j.job_type, j.status, j.current_step, j.error, j.started_at, j.completed_at, s.original_name as filename
      FROM jobs j
      LEFT JOIN sources s ON s.id = j.source_id
      ORDER BY j.created_at DESC
      LIMIT 100
    `).all();

    return NextResponse.json({ jobs });
  } catch (err) {
    console.error('Fetch jobs error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

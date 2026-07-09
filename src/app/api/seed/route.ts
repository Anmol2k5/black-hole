import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { ingestFile } from '@/lib/ingestion/pipeline';
import { getDb } from '@/lib/db/client';

export async function POST() {
  try {
    const seedDir = path.resolve(process.cwd(), 'seed/transcripts');
    
    if (!fs.existsSync(seedDir)) {
      return NextResponse.json({ error: 'Seed directory not found' }, { status: 404 });
    }

    const files = fs.readdirSync(seedDir).filter(f => f.endsWith('.txt'));
    if (files.length === 0) {
      return NextResponse.json({ error: 'No seed files found' }, { status: 404 });
    }

    // Process files sequentially to not overload DB/LLM limits during demo
    const results = [];
    for (const filename of files) {
      // Check if already processed to avoid duplicates during multiple demo clicks
      const db = getDb();
      const existing = db.prepare('SELECT id FROM sources WHERE original_name = ?').get(filename);
      if (existing) continue;

      const filePath = path.join(seedDir, filename);
      const buffer = fs.readFileSync(filePath);
      
      console.log(`Ingesting seed file: ${filename}...`);
      const result = await ingestFile(buffer, filename);
      results.push({ filename, status: result.status });
    }

    return NextResponse.json({ 
      message: 'Seed data loaded', 
      processed: results.length,
      results 
    });
  } catch (err) {
    console.error('Seed error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Seed failed' },
      { status: 500 }
    );
  }
}

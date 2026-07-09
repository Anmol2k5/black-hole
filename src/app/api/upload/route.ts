import { NextResponse } from 'next/server';
import { ingestFile } from '@/lib/ingestion/pipeline';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // For MVP, we're doing synchronous processing. 
    // In production, we'd add to a queue and return immediately.
    const result = await ingestFile(buffer, file.name);

    if (result.status === 'failed') {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { answerQuestion } from '@/lib/query/engine';
import { getDb } from '@/lib/db/client';
import { v4 as uuid } from 'uuid';

export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const result = await answerQuestion(question);

    // Save answer to DB
    const db = getDb();
    const answerId = uuid();
    
    db.prepare(`
      INSERT INTO answers (id, question, answer_text, evidence_json, confidence, gaps, suggested_action, sources_used_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      answerId, 
      question, 
      result.answer, 
      JSON.stringify(result.evidence), 
      result.confidence, 
      result.gaps, 
      result.suggestedAction, 
      JSON.stringify(result.evidence.map(e => e.sourceId))
    );

    // TODO: Implement saveToWiki logic (create synthesis page)

    return NextResponse.json({ ...result, id: answerId });
  } catch (err) {
    console.error('Ask error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to answer question' },
      { status: 500 }
    );
  }
}

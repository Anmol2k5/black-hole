'use client';

import { useState } from 'react';
import { Send, Loader2, FileText, CheckCircle2, Search, BrainCircuit } from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';

interface Evidence {
  sourceTitle: string;
  sourceDate: string;
  quote: string;
}

interface Answer {
  id: string;
  question: string;
  answer: string;
  evidence: Evidence[];
  confidence: 'high' | 'medium' | 'low';
  gaps: string;
  suggestedAction: string;
  sourcesUsed: number;
}

const DEMO_QUESTIONS = [
  "What should we build next?",
  "What are the main pricing objections?",
  "What do customers complain about most?",
  "Which competitors are mentioned most often?"
];

export default function AskPage() {
  const [query, setQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [history, setHistory] = useState<Answer[]>([]);
  const [savedUrls, setSavedUrls] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const saveToWiki = async (id: string) => {
    if (!id || savingId) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/answers/${id}/save-to-wiki`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSavedUrls((prev) => ({ ...prev, [id]: data.url }));
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSavingId(null);
    }
  };

  const askQuestion = async (q: string) => {
    if (!q.trim() || isAsking) return;
    
    setQuery('');
    setIsAsking(true);
    
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to get answer');
      
      setHistory(prev => [{ ...data, question: q }, ...prev]);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Ask the Brain</h1>
        <p className="text-muted-foreground">Query your compiled company knowledge. All answers are cited.</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pb-6 pr-2">
        {history.length === 0 && !isAsking && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-60">
            <BrainCircuit className="w-16 h-16 text-primary" />
            <div>
              <p className="text-lg font-medium">Ready to answer questions</p>
              <p className="text-sm text-muted-foreground mt-1">Try asking one of the suggestions below.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {DEMO_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => askQuestion(q)}
                  className="px-3 py-1.5 bg-muted hover:bg-primary/20 hover:text-primary rounded-full text-sm transition-colors border border-border"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {isAsking && (
          <div className="bg-card border border-primary/20 rounded-xl p-6 shadow-sm flex items-center gap-4 animate-pulse">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-muted-foreground">Compiling answer from wiki and sources...</p>
          </div>
        )}

        {history.map((item, i) => (
          <div key={item.id || i} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-muted/30 border-b border-border flex gap-3 items-start">
              <Search className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <h3 className="font-semibold text-lg">{item.question}</h3>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="prose prose-invert max-w-none">
                <p className="whitespace-pre-wrap">{item.answer}</p>
              </div>

              {item.evidence?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Evidence ({item.sourcesUsed} sources)
                  </h4>
                  <div className="grid gap-3">
                    {item.evidence.map((ev, idx) => (
                      <div key={idx} className="bg-muted/50 rounded-lg p-3 text-sm border border-border/50">
                        <p className="italic mb-2 text-muted-foreground">&ldquo;{ev.quote}&rdquo;</p>
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-primary">{ev.sourceTitle}</span>
                          <span className="text-muted-foreground">{ev.sourceDate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Confidence</h4>
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      "px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider",
                      item.confidence === 'high' ? "bg-emerald-500/20 text-emerald-500" :
                      item.confidence === 'medium' ? "bg-amber-500/20 text-amber-500" :
                      "bg-rose-500/20 text-rose-500"
                    )}>
                      {item.confidence}
                    </span>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Suggested Action</h4>
                  <p className="text-sm">{item.suggestedAction || 'None'}</p>
                </div>

                {item.gaps && (
                  <div className="col-span-full">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Gaps / Unknowns</h4>
                    <p className="text-sm text-muted-foreground">{item.gaps}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="px-6 py-3 bg-muted/30 border-t border-border flex justify-end">
              {savedUrls[item.id] ? (
                <Link
                  href={savedUrls[item.id]}
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" /> Saved — View synthesis
                </Link>
              ) : (
                <button
                  onClick={() => saveToWiki(item.id)}
                  disabled={savingId === item.id}
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {savingId === item.id ? 'Saving…' : 'Save to Wiki as Synthesis'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4 bg-background">
        <form 
          onSubmit={e => { e.preventDefault(); askQuestion(query); }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ask anything about your company data..."
            className="w-full bg-card border border-border rounded-full pl-6 pr-14 py-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
            disabled={isAsking}
          />
          <button 
            type="submit"
            disabled={!query.trim() || isAsking}
            aria-label="Submit question"
            className="absolute right-2 p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'next';
import Link from 'next/link';
import { BookOpen, Loader2, Clock, CheckCircle2, ChevronRight, Hash } from 'lucide-react';
import { clsx } from 'clsx';

interface WikiPage {
  id: string;
  slug: string;
  title: string;
  category: string;
  source_count: number;
  confidence: string;
  updated_at: string;
}

export default function WikiDirectory() {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/wiki')
      .then(res => res.json())
      .then(data => {
        setPages(data.pages || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  // Group by category
  const categories = pages.reduce((acc, page) => {
    if (!acc[page.category]) acc[page.category] = [];
    acc[page.category].push(page);
    return acc;
  }, {} as Record<string, WikiPage[]>);

  const categoryEmoji: Record<string, string> = {
    product: '📦',
    sales: '💰',
    support: '🎧',
    strategy: '🎯',
    synthesis: '🔬',
    customers: '👥',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Company Wiki</h1>
        <p className="text-muted-foreground">
          Auto-generated knowledge base compiled from all raw sources. <br />
          These pages update automatically when new data is uploaded.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {Object.entries(categories).map(([category, categoryPages]) => (
          <div key={category} className="space-y-4">
            <h2 className="text-xl font-semibold capitalize flex items-center gap-2 pb-2 border-b border-border">
              <span>{categoryEmoji[category] || '📄'}</span> {category}
            </h2>
            <div className="grid gap-3">
              {categoryPages.map(page => (
                <Link 
                  href={`/wiki/${page.slug}`} 
                  key={page.id}
                  className="group block bg-card border border-border hover:border-primary/50 hover:bg-muted/30 rounded-xl p-4 transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-medium group-hover:text-primary transition-colors flex items-center gap-1">
                      <Hash className="w-3 h-3 text-muted-foreground" />
                      {page.title}
                    </h3>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className={clsx(
                        "w-3 h-3",
                        page.confidence === 'high' ? "text-emerald-500" :
                        page.confidence === 'medium' ? "text-amber-500" : "text-rose-500"
                      )} />
                      {page.source_count} sources
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(page.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {pages.length === 0 && (
        <div className="text-center p-12 bg-card border border-border rounded-xl">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-1">No wiki pages yet</h3>
          <p className="text-muted-foreground">Upload sources to generate the wiki automatically.</p>
          <Link href="/upload" className="inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
            Upload Data
          </Link>
        </div>
      )}
    </div>
  );
}

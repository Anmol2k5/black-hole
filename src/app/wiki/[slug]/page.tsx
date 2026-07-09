'use client';

import { useState, useEffect } from 'next';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, CheckCircle2, Clock, FileText, Quote, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { clsx } from 'clsx';

export default function WikiPageViewer() {
  const params = useParams();
  const slugArray = params.slug as string[];
  const slug = slugArray?.join('/') || '';
  
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    
    fetch(`/api/wiki?slug=${slug}`)
      .then(res => {
        if (!res.ok) throw new Error('Page not found');
        return res.json();
      })
      .then(d => {
        setData(d);
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [slug]);

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  
  if (error || !data) {
    return (
      <div className="text-center p-12">
        <h3 className="text-lg font-medium text-destructive mb-2">{error || 'Page not found'}</h3>
        <Link href="/wiki" className="text-primary hover:underline flex items-center justify-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Wiki
        </Link>
      </div>
    );
  }

  const { page, citations } = data;

  // Process markdown to strip the frontmatter which we display in UI
  const contentBody = page.content_md.replace(/^---[\s\S]*?---\n*/, '');

  return (
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8 pb-12">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="mb-8">
          <Link href="/wiki" className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Directory
          </Link>
          
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            <span>Wiki</span> <ChevronRight className="w-3 h-3" /> <span className="capitalize">{page.category}</span>
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight mb-4">{page.title}</h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-y border-border py-3 bg-muted/20 px-4 rounded-lg">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className={clsx(
                "w-4 h-4",
                page.confidence === 'high' ? "text-emerald-500" :
                page.confidence === 'medium' ? "text-amber-500" : "text-rose-500"
              )} />
              <span className="font-medium text-foreground capitalize">{page.confidence} Confidence</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-border" />
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              <span>Synthesized from {page.source_count} sources</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-border" />
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>Updated {new Date(page.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="prose prose-invert prose-lg max-w-none">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              h1: ({node, ...props}) => <h1 className="text-3xl font-bold mt-8 mb-4 pb-2 border-b border-border/50" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-2xl font-semibold mt-8 mb-4 text-primary" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-xl font-semibold mt-6 mb-3" {...props} />,
              blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4 bg-muted/30 py-2 pr-4 rounded-r-lg" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc pl-6 space-y-2 mb-6" {...props} />,
              li: ({node, ...props}) => <li className="pl-1 marker:text-primary/50" {...props} />,
            }}
          >
            {contentBody}
          </ReactMarkdown>
        </div>
      </div>

      {/* Citations Sidebar */}
      <div className="w-full md:w-80 shrink-0 space-y-6">
        <div className="sticky top-24 bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <Quote className="w-4 h-4 text-primary" /> Sources & Evidence
          </h3>
          
          <div className="space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto pr-2">
            {citations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No specific citations linked yet.</p>
            ) : (
              citations.map((c: any, i: number) => (
                <div key={i} className="text-sm space-y-2 pb-4 border-b border-border/50 last:border-0 last:pb-0">
                  <p className="font-medium leading-snug">{c.claim_text}</p>
                  {c.quote && (
                    <p className="italic text-muted-foreground border-l-2 border-primary/30 pl-2">
                      "{c.quote}"
                    </p>
                  )}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-primary truncate pr-2" title={c.source_title}>{c.source_title}</span>
                    <span className="text-muted-foreground shrink-0">{c.source_date}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

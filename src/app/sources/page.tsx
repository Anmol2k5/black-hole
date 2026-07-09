'use client';

import { useState, useEffect, Fragment } from 'react';
import { FileText, Loader2, CheckCircle2, AlertCircle, FileArchive, FileJson, File, Calendar, Users, Building, Tag } from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';

interface Source {
  id: string;
  filename: string;
  original_name: string;
  file_type: string;
  category: string;
  source_type: string;
  status: string;
  error?: string;
  title?: string;
  metadata_json?: string;
  uploaded_at: string;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sources')
      .then(res => res.json())
      .then(data => {
        setSources(data.sources || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  const getIcon = (type: string) => {
    switch(type) {
      case 'pdf': return <FileArchive className="w-5 h-5 text-rose-400" />;
      case 'csv': return <FileJson className="w-5 h-5 text-emerald-400" />;
      case 'docx': return <FileText className="w-5 h-5 text-blue-400" />;
      case 'md': return <FileText className="w-5 h-5 text-slate-400" />;
      default: return <File className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (status === 'failed') return <AlertCircle className="w-4 h-4 text-destructive" />;
    return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Raw Sources</h1>
          <p className="text-muted-foreground">Immutable records of all data ingested into the Company Brain.</p>
        </div>
        <div className="text-sm font-medium bg-muted px-3 py-1.5 rounded-full">
          {sources.length} Total Sources
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground uppercase text-xs tracking-wider border-b border-border">
            <tr>
              <th className="px-6 py-4 font-semibold">Source</th>
              <th className="px-6 py-4 font-semibold">Category</th>
              <th className="px-6 py-4 font-semibold">Date Uploaded</th>
              <th className="px-6 py-4 font-semibold text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sources.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                  No sources found. <Link href="/upload" className="text-primary hover:underline">Upload some data</Link>.
                </td>
              </tr>
            ) : (
              sources.map(source => (
                <Fragment key={source.id}>
                  <tr 
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === source.id ? null : source.id)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {getIcon(source.file_type)}
                        <div>
                          <p className="font-medium text-foreground">{source.title || source.original_name}</p>
                          {source.title && <p className="text-xs text-muted-foreground">{source.original_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground uppercase">
                        {source.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(source.uploaded_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 flex items-center justify-end gap-2">
                      <span className="capitalize">{source.status}</span>
                      {getStatusIcon(source.status)}
                    </td>
                  </tr>
                  
                  {expandedId === source.id && source.metadata_json && (
                    <tr className="bg-muted/10 border-b border-border">
                      <td colSpan={4} className="px-6 py-6">
                        <SourceMetadata data={JSON.parse(source.metadata_json)} error={source.error} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SourceMetadata({ data, error }: { data: any, error?: string }) {
  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
        <h4 className="font-semibold flex items-center gap-2 mb-1"><AlertCircle className="w-4 h-4" /> Error during processing</h4>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><Calendar className="w-3 h-3" /> Document Date</h4>
        <p className="text-sm">{data.date || 'Unknown'}</p>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><Users className="w-3 h-3" /> People</h4>
        <div className="flex flex-wrap gap-1.5">
          {data.people?.length ? data.people.map((p: string, i: number) => (
            <span key={i} className="bg-background border border-border px-2 py-0.5 rounded text-xs">{p}</span>
          )) : <span className="text-sm text-muted-foreground">None</span>}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><Building className="w-3 h-3" /> Companies</h4>
        <div className="flex flex-wrap gap-1.5">
          {data.companies?.length ? data.companies.map((c: string, i: number) => (
            <span key={i} className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-xs">{c}</span>
          )) : <span className="text-sm text-muted-foreground">None</span>}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><Tag className="w-3 h-3" /> Topics</h4>
        <div className="flex flex-wrap gap-1.5">
          {data.topics?.length ? data.topics.map((t: string, i: number) => (
            <span key={i} className="bg-background border border-border px-2 py-0.5 rounded text-xs">{t}</span>
          )) : <span className="text-sm text-muted-foreground">None</span>}
        </div>
      </div>
    </div>
  );
}

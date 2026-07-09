'use client';

import { useState, useCallback } from 'next';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface UploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: string;
  error?: string;
  sourceId?: string;
}

export default function UploadPage() {
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newUploads = acceptedFiles.map(file => ({
      file,
      status: 'pending' as const,
      progress: 'Waiting...',
    }));
    
    setUploads(prev => [...prev, ...newUploads]);
    
    // Process each file
    newUploads.forEach(upload => processFile(upload.file));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const processFile = async (file: File) => {
    updateStatus(file.name, { status: 'uploading', progress: 'Ingesting & Analyzing...' });
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      updateStatus(file.name, { 
        status: 'completed', 
        progress: 'Compiled into wiki',
        sourceId: data.sourceId
      });
    } catch (err) {
      updateStatus(file.name, { 
        status: 'error', 
        progress: 'Failed',
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  };

  const updateStatus = (filename: string, updates: Partial<UploadStatus>) => {
    setUploads(prev => prev.map(u => 
      u.file.name === filename ? { ...u, ...updates } : u
    ));
  };

  const loadSeedData = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to load seed data');
      alert('Seed data loaded successfully! Go check the Wiki.');
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Upload Data</h1>
          <p className="text-muted-foreground">Upload call transcripts, meeting notes, and PDFs to compile into the wiki.</p>
        </div>
        <button 
          onClick={loadSeedData}
          disabled={isSeeding}
          className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
        >
          {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Load Demo Data
        </button>
      </div>

      <div 
        {...getRootProps()} 
        className={clsx(
          "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex justify-center mb-4">
          <div className="bg-primary/10 p-4 rounded-full">
            <UploadCloud className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h3 className="text-lg font-semibold mb-1">Click or drag files here</h3>
        <p className="text-sm text-muted-foreground">Supports .txt, .md, .pdf, .docx, .csv (Max 10MB per file)</p>
      </div>

      {uploads.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="font-medium text-sm">Upload Queue ({uploads.length})</h3>
          </div>
          <ul className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {uploads.map((upload, i) => (
              <li key={i} className="px-4 py-3 flex items-center gap-4">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{upload.file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{upload.progress}</p>
                  {upload.error && (
                    <p className="text-xs text-destructive mt-0.5">{upload.error}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {upload.status === 'pending' && <div className="w-2 h-2 rounded-full bg-muted-foreground" />}
                  {upload.status === 'uploading' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                  {upload.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  {upload.status === 'error' && <AlertCircle className="w-5 h-5 text-destructive" />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

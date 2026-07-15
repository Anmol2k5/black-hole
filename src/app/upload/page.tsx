'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { mapJobToUploadState, isTerminalState, type JobStatusResponse } from '@/lib/uploads/job-state';

interface UploadStatus {
  clientId: string;
  file: File;
  sourceId?: string;
  jobId?: string;
  status:
    | 'pending'
    | 'uploading'
    | 'queued'
    | 'processing'
    | 'retrying'
    | 'completed'
    | 'needs_ocr'
    | 'failed';
  progressPercent: number;
  progressLabel: string;
  error?: string;
}

export default function UploadPage() {
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedEnabled, setSeedEnabled] = useState(false);
  const timeouts = useRef<Map<string, number>>(new Map());

  // Fetch config on mount
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setSeedEnabled(!!data.seedEnabled))
      .catch(() => setSeedEnabled(false));
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    const currentTimeouts = timeouts.current;
    return () => {
      currentTimeouts.forEach(id => window.clearTimeout(id));
    };
  }, []);

  const updateStatus = useCallback((clientId: string, updates: Partial<UploadStatus>) => {
    setUploads(prev => prev.map(u =>
      u.clientId === clientId ? { ...u, ...updates } : u
    ));
  }, []);



  // Create a ref for the pollJob function to avoid dependency cycles
  const pollJobRef = useRef<((clientId: string, jobId: string) => Promise<void>) | null>(null);
  
  const pollJob = useCallback(async (clientId: string, jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Job not found');
      
      const job = (await response.json()) as JobStatusResponse;
      updateStatus(clientId, mapJobToUploadState(job));

      const terminal = isTerminalState(job);

      if (!terminal) {
        const id = window.setTimeout(() => {
          if (pollJobRef.current) void pollJobRef.current(clientId, jobId);
        }, 1500);
        timeouts.current.set(clientId, id);
      }
    } catch (err) {
      console.error(err);
      updateStatus(clientId, { status: 'failed', progressLabel: 'Error tracking job' });
    }
  }, [updateStatus]);

  // Keep ref updated
  useEffect(() => {
    pollJobRef.current = pollJob;
  }, [pollJob]);

  const processFile = useCallback(async (uploadState: UploadStatus) => {
    updateStatus(uploadState.clientId, { status: 'uploading', progressLabel: 'Uploading...' });

    const formData = new FormData();
    formData.append('file', uploadState.file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Upload failed');

      const result = data.results?.[0];
      if (result?.status === 'duplicate') {
        updateStatus(uploadState.clientId, {
          status: 'completed',
          progressLabel: 'Already uploaded',
          sourceId: result.existingSourceId,
          progressPercent: 100
        });
        return;
      }

      const sourceId = result?.sourceId ?? data.sourceId;
      const jobId = result?.jobId ?? data.jobId;
      
      updateStatus(uploadState.clientId, {
        status: 'queued',
        progressLabel: 'Waiting for processing...',
        sourceId,
        jobId
      });

      if (!jobId) {
        throw new Error(
          "Upload was accepted without a processing job ID.",
        );
      }

      void pollJob(uploadState.clientId, jobId);
    } catch (err) {
      updateStatus(uploadState.clientId, {
        status: 'failed',
        progressLabel: 'Failed to upload',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [updateStatus, pollJob]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newUploads = acceptedFiles.map(file => ({
      clientId: crypto.randomUUID(),
      file,
      status: 'pending' as const,
      progressLabel: 'Waiting...',
      progressPercent: 0,
    }));

    setUploads(prev => [...prev, ...newUploads]);

    newUploads.forEach(upload => processFile(upload));
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const loadSeedData = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to load seed data');
      alert('Seed data enqueued successfully! Check the Jobs view or wait a few moments.');
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
        {seedEnabled && (
          <button 
            onClick={loadSeedData}
            disabled={isSeeding}
            className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
          >
            {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Load Demo Data
          </button>
        )}
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
            {uploads.map((upload) => (
              <li key={upload.clientId} className="px-4 py-3 flex items-center gap-4">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{upload.file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{upload.progressLabel} {upload.progressPercent > 0 && upload.progressPercent < 100 ? `(${upload.progressPercent}%)` : ''}</p>
                  {upload.error && (
                    <p className="text-xs text-destructive mt-0.5">{upload.error}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {upload.status === 'pending' && <div className="w-2 h-2 rounded-full bg-muted-foreground" />}
                  {(upload.status === 'uploading' || upload.status === 'queued' || upload.status === 'processing' || upload.status === 'retrying') && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                  {upload.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  {(upload.status === 'failed' || upload.status === 'needs_ocr') && <AlertCircle className="w-5 h-5 text-destructive" />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

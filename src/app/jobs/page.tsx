'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Clock } from 'lucide-react';
import { clsx } from 'clsx';

interface Job {
  id: string;
  job_type: string;
  status: string;
  current_step: string;
  error?: string;
  started_at: string;
  completed_at?: string;
  filename?: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchJobs = () => {
    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => {
        setJobs(data.jobs || []);
        setIsLoading(false);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (status === 'failed') return <AlertCircle className="w-5 h-5 text-destructive" />;
    return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Background Jobs</h1>
        <p className="text-muted-foreground">Track ingestion, extraction, and compilation tasks.</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <ul className="divide-y divide-border">
          {jobs.length === 0 ? (
            <li className="p-12 text-center text-muted-foreground">No jobs recorded yet.</li>
          ) : (
            jobs.map(job => (
              <li key={job.id} className="p-4 sm:px-6 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(job.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize">{job.job_type}</span>
                        <span className="text-muted-foreground">|</span>
                        <span className="text-sm font-medium">{job.filename || 'System Task'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={clsx(
                          "text-xs font-medium px-2 py-0.5 rounded uppercase tracking-wider",
                          job.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" :
                          job.status === 'failed' ? "bg-destructive/10 text-destructive" :
                          "bg-primary/10 text-primary"
                        )}>
                          {job.status}
                        </span>
                        <span className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-md">
                          {job.status === 'failed' ? job.error : job.current_step}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right text-sm text-muted-foreground hidden sm:block">
                    <div className="flex items-center justify-end gap-1 mb-1">
                      <Clock className="w-3 h-3" />
                      {new Date(job.started_at).toLocaleTimeString()}
                    </div>
                    {job.completed_at && (
                      <div className="text-xs">
                        Finished: {new Date(job.completed_at).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

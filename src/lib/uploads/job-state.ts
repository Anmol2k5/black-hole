export interface JobStatusResponse {
  id: string;
  status:
    | "queued"
    | "running"
    | "retrying"
    | "completed"
    | "failed"
    | "cancelled";
  sourceStatus:
    | "pending"
    | "extracting"
    | "analyzing"
    | "compiling"
    | "completed"
    | "failed"
    | "needs_ocr";
  currentStep: string | null;
  progressPercent: number;
  error: string | null;
}

export type UploadProgressState =
  | 'pending'
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'retrying'
  | 'completed'
  | 'needs_ocr'
  | 'failed';

export interface MappedUploadState {
  status: UploadProgressState;
  progressLabel: string;
  progressPercent: number;
  error?: string;
}

export function mapJobToUploadState(job: JobStatusResponse): MappedUploadState {
  if (job.sourceStatus === 'needs_ocr') {
    return { status: 'needs_ocr', progressLabel: 'Needs OCR (Text not found)', progressPercent: 100 };
  }
  if (job.status === 'failed') {
    return { status: 'failed', progressLabel: 'Failed', progressPercent: job.progressPercent || 0, error: job.error || undefined };
  }
  if (job.status === 'cancelled') {
    return { status: 'failed', progressLabel: 'Cancelled', progressPercent: job.progressPercent || 0 };
  }
  if (job.status === 'completed') {
    return { status: 'completed', progressLabel: 'Compiled into wiki', progressPercent: 100 };
  }
  if (job.status === 'retrying') {
    return { status: 'retrying', progressLabel: `Retrying... (${job.error || 'Unknown error'})`, progressPercent: job.progressPercent || 0 };
  }
  
  // running or queued
  const isRunning = job.status === 'running';
  return {
    status: isRunning ? 'processing' : 'queued',
    progressLabel: isRunning ? (job.currentStep || 'Processing...') : 'Waiting...',
    progressPercent: job.progressPercent || 0,
  };
}

export function isTerminalState(job: JobStatusResponse): boolean {
  return (
    job.status === "completed" ||
    job.status === "failed" ||
    job.status === "cancelled" ||
    job.sourceStatus === "needs_ocr"
  );
}

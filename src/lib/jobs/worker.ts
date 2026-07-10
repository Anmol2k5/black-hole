/**
 * Job worker. Claims queued jobs from the SQLite queue and processes them.
 * A single worker instance is enough for a local private alpha. The same
 * module can run in-process (started from instrumentation) or as a standalone
 * script (scripts/worker.ts).
 */

import { claimNext, markFailed, type JobRow } from "./queue";
import { processIngestionJob } from "../ingestion/pipeline";

const WORKER_ID = `worker-${Math.random().toString(36).slice(2, 8)}`;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Claim and process a single job. Returns true if a job was processed.
 */
export async function runOneJob(): Promise<boolean> {
  const job = claimNext(WORKER_ID);
  if (!job) return false;

  try {
    await dispatch(job);
  } catch (err) {
    console.error(`Worker failed job ${job.id}:`, err);
    markFailed(job.id, err instanceof Error ? err.message : String(err));
  }
  return true;
}

async function dispatch(job: JobRow): Promise<void> {
  switch (job.job_type) {
    case "ingest":
      if (job.source_id) {
        await processIngestionJob(job.id, job.source_id);
      } else {
        markFailed(job.id, "Ingest job has no source_id");
      }
      break;
    default:
      markFailed(job.id, `Unknown job type: ${job.job_type}`);
  }
}

/**
 * Start a polling loop. Safe to call multiple times (idempotent).
 */
export function startWorker(intervalMs = 2000): void {
  if (timer) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      // Drain available jobs before yielding to the next tick.
      while (await runOneJob()) {
        /* keep going */
      }
    } finally {
      running = false;
    }
  };
  timer = setInterval(tick, intervalMs);
  // Kick off immediately.
  void tick();
}

export function stopWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

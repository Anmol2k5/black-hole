/**
 * Durable SQLite-backed job queue.
 *
 * Jobs are locked atomically so a single worker (or a few) can process them
 * without double-execution. Retries use an exponential backoff via
 * next_attempt_at. A single SQLite file is sufficient for a local private
 * alpha — no Redis required.
 */

import { v4 as uuid } from "uuid";
import { getDb } from "../db/client";

export type JobStatus =
  | "queued"
  | "running"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobRow {
  id: string;
  org_id: string;
  source_id: string | null;
  job_type: string;
  status: JobStatus;
  current_step: string | null;
  total_steps: number;
  completed_steps: number;
  attempt_count: number;
  max_attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  next_attempt_at: string | null;
  progress_percent: number;
  error: string | null;
  result_json: string | null;
  started_at: string | null;
  completed_at: string | null;
}

const ORG = "default";

export function enqueue(
  sourceId: string,
  jobType = "ingest",
  totalSteps = 6,
): string {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO jobs (id, org_id, source_id, job_type, status, total_steps, attempt_count, max_attempts)
     VALUES (?, ?, ?, ?, 'queued', ?, 0, 3)`,
  ).run(id, ORG, sourceId, jobType, totalSteps);
  return id;
}

/**
 * Atomically claim the next runnable job. Returns null if none are available.
 * The lock is set within a single UPDATE statement so concurrent workers
 * cannot claim the same row.
 */
export function claimNext(workerId: string): JobRow | null {
  const db = getDb();
  const now = new Date().toISOString();

  const update = db.prepare(`
    UPDATE jobs
    SET status = 'running', locked_at = ?, locked_by = ?, started_at = COALESCE(started_at, ?)
    WHERE id = (
      SELECT id FROM jobs
      WHERE status IN ('queued', 'retrying')
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
        AND locked_at IS NULL
      ORDER BY
        CASE status WHEN 'retrying' THEN 0 ELSE 1 END,
        created_at
      LIMIT 1
    )
  `);
  const info = update.run(now, workerId, now, now);
  if (info.changes === 0) return null;

  return db
    .prepare(`SELECT * FROM jobs WHERE locked_by = ? AND status = 'running' ORDER BY locked_at DESC LIMIT 1`)
    .get(workerId) as JobRow;
}

export function updateProgress(
  jobId: string,
  step: string,
  completedSteps: number,
  totalSteps: number,
  progressPercent: number,
): void {
  getDb()
    .prepare(
      `UPDATE jobs SET current_step = ?, completed_steps = ?, total_steps = ?, progress_percent = ? WHERE id = ?`,
    )
    .run(step, completedSteps, totalSteps, progressPercent, jobId);
}

export function markCompleted(jobId: string, resultJson?: unknown): void {
  getDb()
    .prepare(
      `UPDATE jobs SET status = 'completed', completed_at = ?, locked_at = NULL, progress_percent = 100,
        result_json = ? WHERE id = ?`,
    )
    .run(new Date().toISOString(), resultJson ? JSON.stringify(resultJson) : null, jobId);
}

export function markFailed(jobId: string, error: string): void {
  const db = getDb();
  const job = db.prepare(`SELECT attempt_count, max_attempts FROM jobs WHERE id = ?`).get(jobId) as {
    attempt_count: number;
    max_attempts: number;
  };
  const attempts = (job?.attempt_count ?? 0) + 1;
  const max = job?.max_attempts ?? 3;

  if (attempts < max) {
    // Exponential backoff: 5s, 10s, 20s, ...
    const delayMs = Math.min(5 * 1000 * 2 ** (attempts - 1), 2 * 60 * 1000);
    const next = new Date(Date.now() + delayMs).toISOString();
    db.prepare(
      `UPDATE jobs SET attempt_count = ?, status = 'retrying', error = ?, next_attempt_at = ?, locked_at = NULL WHERE id = ?`,
    ).run(attempts, error, next, jobId);
  } else {
    db.prepare(
      `UPDATE jobs SET attempt_count = ?, status = 'failed', error = ?, locked_at = NULL WHERE id = ?`,
    ).run(attempts, error, jobId);
  }
}

/** Re-queue a failed/cancelled job for immediate retry. */
export function requeue(jobId: string): void {
  getDb()
    .prepare(
      `UPDATE jobs SET status = 'queued', error = NULL, locked_at = NULL, next_attempt_at = NULL, attempt_count = 0 WHERE id = ?`,
    )
    .run(jobId);
}

export function cancel(jobId: string): void {
  getDb()
    .prepare(`UPDATE jobs SET status = 'cancelled', locked_at = NULL WHERE id = ?`)
    .run(jobId);
}

export function getJob(jobId: string): JobRow | null {
  return (getDb().prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as JobRow) ?? null;
}

export function listJobs(limit = 50): JobRow[] {
  return getDb()
    .prepare(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as JobRow[];
}

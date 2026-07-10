import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { listJobs } from "@/lib/jobs/queue";

export async function GET() {
  try {
    const jobs = listJobs(100).map((j) => ({
      id: j.id,
      job_type: j.job_type,
      status: j.status,
      current_step: j.current_step,
      progress_percent: j.progress_percent,
      attempt_count: j.attempt_count,
      max_attempts: j.max_attempts,
      error: j.error,
      started_at: j.started_at,
      completed_at: j.completed_at,
      source_id: j.source_id,
      filename: j.source_id
        ? (getDb().prepare("SELECT original_name FROM sources WHERE id = ?").get(j.source_id) as { original_name: string } | undefined)?.original_name
        : null,
    }));

    return NextResponse.json({ jobs });
  } catch (err) {
    console.error("Fetch jobs error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch jobs" },
      { status: 500 },
    );
  }
}

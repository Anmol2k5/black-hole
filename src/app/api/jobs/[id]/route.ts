import { NextResponse } from "next/server";
import { getJob, requeue, cancel } from "@/lib/jobs/queue";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const job = getJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    let sourceStatus = "pending";
    if (job.source_id) {
      const db = require("@/lib/db/client").getDb();
      const source = db.prepare("SELECT status FROM sources WHERE id = ?").get(job.source_id) as { status: string } | undefined;
      if (source) {
        sourceStatus = source.status;
      }
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      sourceStatus,
      currentStep: job.current_step,
      progressPercent: job.progress_percent,
      error: job.error,
    });
  } catch (err) {
    console.error("Job GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get job" },
      { status: 500 },
    );
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const job = getJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const action = new URL(_req.url).searchParams.get("action") || "retry";

    if (action === "cancel") {
      cancel(id);
      return NextResponse.json({ id, status: "cancelled" });
    }

    // default: retry
    requeue(id);
    return NextResponse.json({ id, status: "queued" });
  } catch (err) {
    console.error("Job action error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update job" },
      { status: 500 },
    );
  }
}

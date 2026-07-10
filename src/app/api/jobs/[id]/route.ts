import { NextResponse } from "next/server";
import { getJob, requeue, cancel } from "@/lib/jobs/queue";

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

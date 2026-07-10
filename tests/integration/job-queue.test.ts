import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getDb, closeDb } from "@/lib/db/client";
import { saveUploadedFile, findDuplicateSource, checksumBuffer } from "@/lib/ingestion/file-storage";
import {
  enqueue,
  claimNext,
  markCompleted,
  markFailed,
  requeue,
  cancel,
  getJob,
  listJobs,
} from "@/lib/jobs/queue";

function resetDb(): void {
  const db = getDb();
  db.exec("DELETE FROM jobs; DELETE FROM sources; DELETE FROM chunks; DELETE FROM observations; DELETE FROM claims; DELETE FROM claim_evidence;");
}

describe("job queue flow", () => {
  beforeEach(resetDb);

  it("enqueues, claims, completes, and lists a job", async () => {
    const sourceId = await saveUploadedFile(Buffer.from("hello world"), "call-acme.txt");
    const jobId = enqueue(sourceId, "ingest", 6);

    const claimed = claimNext("worker-1");
    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe(jobId);
    expect(claimed!.status).toBe("running");
    expect(claimed!.locked_by).toBe("worker-1");

    // A second worker should not claim the same running job.
    expect(claimNext("worker-2")).toBeNull();

    markCompleted(jobId, { sourceId });
    const done = getJob(jobId);
    expect(done!.status).toBe("completed");
    expect(done!.progress_percent).toBe(100);
    expect(listJobs(10).some((j) => j.id === jobId)).toBe(true);
  });

  it("marks failed and then requeues for retry", async () => {
    const sourceId = await saveUploadedFile(Buffer.from("data"), "call-beta.txt");
    const jobId = enqueue(sourceId);
    claimNext("w");
    markFailed(jobId, "boom");
    expect(getJob(jobId)!.status).toBe("retrying");

    requeue(jobId);
    const re = getJob(jobId)!;
    expect(re.status).toBe("queued");
    expect(re.attempt_count).toBe(0);
    expect(re.error).toBeNull();
  });

  it("can be cancelled", async () => {
    const sourceId = await saveUploadedFile(Buffer.from("data"), "call-gamma.txt");
    const jobId = enqueue(sourceId);
    cancel(jobId);
    expect(getJob(jobId)!.status).toBe("cancelled");
    expect(claimNext("w")).toBeNull();
  });
});

describe("duplicate detection", () => {
  beforeEach(resetDb);

  it("detects an identical upload by checksum", async () => {
    const buffer = Buffer.from("identical transcript content here");
    const id1 = await saveUploadedFile(buffer, "call-one.txt");
    expect(checksumBuffer(buffer)).toMatch(/^[a-f0-9]{64}$/);

    const dup = findDuplicateSource(checksumBuffer(buffer));
    expect(dup?.id).toBe(id1);

    const id2 = await saveUploadedFile(buffer, "call-one-copy.txt");
    expect(id2).not.toBe(id1);
  });
});

afterAll(() => closeDb());

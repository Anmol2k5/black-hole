import { NextResponse } from "next/server";
import { enqueueIngestion } from "@/lib/ingestion/pipeline";
import {
  validateUploadFile,
  MAX_FILES_PER_REQUEST,
} from "@/lib/uploads/policy";
import { checksumBuffer, findDuplicateSource } from "@/lib/ingestion/file-storage";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const entries = formData.getAll("files");
    const single = formData.get("file");
    const files = [...entries, ...(single ? [single] : [])].filter(
      (f): f is File => f instanceof File,
    );

    if (files.length === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Too many files (max ${MAX_FILES_PER_REQUEST} per request).` },
        { status: 400 },
      );
    }

    const results: Array<Record<string, unknown>> = [];

    for (const file of files) {
      const validation = validateUploadFile(file);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: validation.status });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const checksum = checksumBuffer(buffer);
      const existing = findDuplicateSource(checksum);

      if (existing) {
        results.push({
          status: "duplicate",
          duplicate: true,
          existingSourceId: existing.id,
          originalName: file.name,
          message: "A file with identical content already exists.",
        });
        continue;
      }

      // Validate + enqueue; processing happens asynchronously in the worker.
      const enqueued = await enqueueIngestion(buffer, file.name);
      results.push({ ...enqueued, originalName: file.name });
    }

    // 202 Accepted: the upload is received and queued, not yet processed.
    return NextResponse.json({ results }, { status: 202 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}

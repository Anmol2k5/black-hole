import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractText } from "@/lib/ingestion/text-extractor";
import { closeDb } from "@/lib/db/client";
import { ExtractionError } from "@/lib/ingestion/errors";

function writeTemp(name: string, content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bh-extract-"));
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  return p;
}

describe("text extraction", () => {
  it("extracts plain .txt content", async () => {
    const p = writeTemp("note.txt", "Customers repeatedly request Slack integration.");
    const text = await extractText(p, "txt");
    expect(text).toContain("Slack integration");
  });

  it("parses a .vtt transcript into timestamped cues", async () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Jane: Onboarding took almost an hour.

00:00:05.000 --> 00:00:08.000
Bob: Pricing feels expensive for our tier.`;
    const p = writeTemp("call.vtt", vtt);
    const text = await extractText(p, "vtt");
    expect(text).toContain("[00:00:01.000]");
    expect(text).toContain("Jane:");
    expect(text).toContain("Onboarding took almost an hour.");
  });

  it("throws ExtractionError on empty/meaningless content", async () => {
    const p = writeTemp("tiny.txt", "x");
    await expect(extractText(p, "txt")).rejects.toBeInstanceOf(ExtractionError);
  });
});

afterAll(() => closeDb());

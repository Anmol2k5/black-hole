/**
 * Text extraction from various file formats.
 *
 * Every extractor either returns meaningful text or throws an ExtractionError.
 * Extraction failures are NEVER returned as pseudo-content (that would later be
 * embedded and compiled into the wiki).
 */

import fs from "node:fs";
import { ExtractionError } from "./errors";

const MIN_MEANINGFUL_CHARS = 20;

function assertMeaningful(text: string, label: string): string {
  if (text.trim().length < MIN_MEANINGFUL_CHARS) {
    throw new ExtractionError(`No meaningful text could be extracted (${label}).`);
  }
  return text;
}

/**
 * Extract text content from a file based on its type.
 */
export async function extractText(filePath: string, fileType: string): Promise<string> {
  let text: string;

  switch (fileType) {
    case "txt":
    case "md":
      text = fs.readFileSync(filePath, "utf-8");
      break;
    case "pdf":
      text = await extractPdf(filePath);
      break;
    case "docx":
      text = await extractDocx(filePath);
      break;
    case "csv":
      text = await extractCsv(filePath);
      break;
    case "json":
      text = extractJson(filePath);
      break;
    case "vtt":
    case "srt":
      text = extractTranscript(filePath, fileType);
      break;
    default:
      text = fs.readFileSync(filePath, "utf-8");
      break;
  }

  return assertMeaningful(text, fileType);
}

async function extractPdf(filePath: string): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      const text = result?.text?.trim() ?? "";
      if (!text) {
        throw new ExtractionError("PDF contains no extractable text (likely scanned).", {
          needsOcr: true,
        });
      }
      return text;
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    throw new ExtractionError("PDF extraction failed", { cause: err });
  }
}

async function extractDocx(filePath: string): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    if (!result.value.trim()) {
      throw new ExtractionError("DOCX contains no extractable text.");
    }
    return result.value;
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    throw new ExtractionError("DOCX extraction failed", { cause: err });
  }
}

async function extractCsv(filePath: string): Promise<string> {
  try {
    const Papa = (await import("papaparse")).default;
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
    const rows = (parsed.data as Record<string, unknown>[]) || [];

    if (rows.length === 0) {
      throw new ExtractionError("CSV has no data rows.");
    }

    const headers = (parsed.meta.fields || []).filter((h) => h && h.trim());
    const lines = rows.map((row, i) => {
      const fields = headers
        .map((h) => {
          const v = row[h];
          const str = v == null ? "" : String(v).trim();
          if (!str) return null;
          // Avoid exploding extremely wide cells into the index.
          const capped = str.length > 500 ? `${str.slice(0, 500)}…` : str;
          return `${h}: ${capped}`;
        })
        .filter(Boolean)
        .join(" | ");
      return `Row ${i + 1}: ${fields}`;
    });

    return `CSV Data (${rows.length} rows, ${headers.length} columns):\n\n${lines.join("\n")}`;
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    throw new ExtractionError("CSV extraction failed", { cause: err });
  }
}

function extractJson(filePath: string): string {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const text = `JSON Document:\n\n${JSON.stringify(parsed, null, 2)}`;
    return text;
  } catch (err) {
    throw new ExtractionError("JSON extraction failed", { cause: err });
  }
}

/**
 * Parse .vtt / .srt transcripts into timestamped, speaker-aware text.
 */
function extractTranscript(filePath: string, fileType: string): string {
  const raw = fs.readFileSync(filePath, "utf-8");
  const isSrt = fileType === "srt";

  const blocks = raw
    .replace(/\r/g, "")
    .split(/\n\s*\n/) // cues are separated by blank lines in both VTT and SRT
    .map((b) => b.trim())
    .filter(Boolean);

  const cues: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    // Drop the leading index line for SRT.
    let start = 0;
    if (isSrt && /^\d+$/.test(lines[0]?.trim() ?? "")) start = 1;

    // Find the timestamp line.
    let tsLine = -1;
    for (let i = start; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        tsLine = i;
        break;
      }
    }
    if (tsLine === -1) continue;

    const timestamp = lines[tsLine].split("-->")[0].trim();
    const body = lines
      .slice(tsLine + 1)
      .join(" ")
      .trim();
    if (!body) continue;

    const speakerMatch = body.match(/^([A-Z][\w.'-]*)\s*:\s*([\s\S]*)$/);
    if (speakerMatch) {
      cues.push(`[${timestamp}] ${speakerMatch[1]}: ${speakerMatch[2]}`);
    } else {
      cues.push(`[${timestamp}] ${body}`);
    }
  }

  if (cues.length === 0) {
    throw new ExtractionError("Transcript contains no recognizable cues.");
  }

  return `Transcript (${fileType.toUpperCase()}):\n\n${cues.join("\n")}`;
}

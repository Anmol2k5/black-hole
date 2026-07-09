/**
 * Text extraction from various file formats.
 */

import fs from 'fs';

/**
 * Extract text content from a file based on its type.
 */
export async function extractText(filePath: string, fileType: string): Promise<string> {
  switch (fileType) {
    case 'txt':
    case 'md':
      return fs.readFileSync(filePath, 'utf-8');

    case 'pdf':
      return extractPdf(filePath);

    case 'docx':
      return extractDocx(filePath);

    case 'csv':
      return extractCsv(filePath);

    case 'json':
      return extractJson(filePath);

    default:
      return fs.readFileSync(filePath, 'utf-8');
  }
}

async function extractPdf(filePath: string): Promise<string> {
  try {
    // pdf-parse has a quirky import
    const pdfParseModule = (await import('pdf-parse')) as any;
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  } catch (err) {
    console.error('PDF extraction failed:', err);
    return `[PDF extraction failed: ${(err as Error).message}]`;
  }
}

async function extractDocx(filePath: string): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (err) {
    console.error('DOCX extraction failed:', err);
    return `[DOCX extraction failed: ${(err as Error).message}]`;
  }
}

async function extractCsv(filePath: string): Promise<string> {
  try {
    const Papa = (await import('papaparse')).default;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const result = Papa.parse(raw, { header: true });

    if (!result.data || result.data.length === 0) return raw;

    // Convert CSV rows into readable text
    const rows = result.data as Record<string, string>[];
    const lines = rows.map((row, i) => {
      const fields = Object.entries(row)
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      return `Row ${i + 1}: ${fields}`;
    });

    return `CSV Data (${rows.length} rows):\n\n${lines.join('\n')}`;
  } catch (err) {
    console.error('CSV extraction failed:', err);
    return fs.readFileSync(filePath, 'utf-8');
  }
}

function extractJson(filePath: string): string {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return `JSON Document:\n\n${JSON.stringify(parsed, null, 2)}`;
  } catch {
    return fs.readFileSync(filePath, 'utf-8');
  }
}

/**
 * File storage module.
 * Saves uploaded files to the data/raw/ directory and creates DB records.
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/client';
import { dataPath } from '../config';

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  calls: ['call', 'transcript', 'conversation', 'interview', 'recording'],
  support: ['support', 'ticket', 'issue', 'bug', 'complaint', 'help'],
  sales: ['sales', 'deal', 'proposal', 'pitch', 'prospect', 'lead', 'pipeline'],
  meetings: ['meeting', 'standup', 'retro', 'review', 'sync', 'minutes'],
  docs: ['doc', 'guide', 'spec', 'prd', 'rfc', 'readme', 'policy'],
};

/**
 * Classify a file into a category based on filename heuristics.
 */
export function classifyCategory(filename: string): string {
  const lower = filename.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category;
    }
  }
  return 'docs';
}

/**
 * Get file type from extension.
 */
export function getFileType(filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  return ['txt', 'md', 'pdf', 'csv', 'docx', 'json'].includes(ext) ? ext : 'txt';
}

/**
 * Save an uploaded file to disk and create a source record.
 * Returns the source ID.
 */
export async function saveUploadedFile(
  fileBuffer: Buffer,
  originalName: string,
): Promise<string> {
  const id = uuid();
  const category = classifyCategory(originalName);
  const fileType = getFileType(originalName);
  const safeName = `${id}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  // Ensure directory exists
  const dir = dataPath('raw', category);
  fs.mkdirSync(dir, { recursive: true });

  // Write file
  const filePath = path.join(dir, safeName);
  fs.writeFileSync(filePath, fileBuffer);

  // Create DB record
  const db = getDb();
  db.prepare(`
    INSERT INTO sources (id, filename, original_name, file_path, file_type, category, file_size, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(id, safeName, originalName, filePath, fileType, category, fileBuffer.length);

  return id;
}

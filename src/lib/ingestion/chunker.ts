/**
 * Text chunking module.
 * Splits documents into overlapping chunks for embedding and retrieval.
 */

export interface TextChunk {
  content: string;
  index: number;
  charStart: number;
  charEnd: number;
}

/**
 * Split text into overlapping chunks, respecting paragraph boundaries.
 */
export function chunkText(
  text: string,
  maxChunkSize: number = 500,
  overlap: number = 50
): TextChunk[] {
  if (!text || text.trim().length === 0) return [];

  // Split into paragraphs first
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let chunkStart = 0;
  let currentPos = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();

    // Find the actual position in the original text
    const paraStart = text.indexOf(trimmed, currentPos);
    if (paraStart >= 0) currentPos = paraStart;

    // If adding this paragraph would exceed max size, finalize current chunk
    const wordCount = (currentChunk + ' ' + trimmed).split(/\s+/).length;

    if (wordCount > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunks.length,
        charStart: chunkStart,
        charEnd: currentPos,
      });

      // Start new chunk with overlap from end of previous chunk
      const words = currentChunk.trim().split(/\s+/);
      const overlapWords = words.slice(-overlap);
      currentChunk = overlapWords.join(' ') + '\n\n' + trimmed;
      chunkStart = Math.max(0, currentPos - overlapWords.join(' ').length);
    } else {
      if (currentChunk.length === 0) {
        chunkStart = currentPos;
      }
      currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + trimmed;
    }

    currentPos += trimmed.length;
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunks.length,
      charStart: chunkStart,
      charEnd: text.length,
    });
  }

  return chunks;
}

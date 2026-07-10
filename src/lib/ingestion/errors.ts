/**
 * Errors raised during ingestion/extraction.
 */

export class ExtractionError extends Error {
  /** True when the document appears scanned / has no extractable text. */
  readonly needsOcr: boolean;

  constructor(message: string, options?: { cause?: unknown; needsOcr?: boolean }) {
    super(message);
    this.name = "ExtractionError";
    this.needsOcr = options?.needsOcr ?? false;
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

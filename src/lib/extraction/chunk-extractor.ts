/**
 * Chunk-level observation extraction (Phase 9).
 *
 * Extracts observations from a single document segment. Each observation is
 * tied to the segment's location so it can later be traced to a chunk.
 */

import { extractJSON } from "../llm/provider";
import { ObservationSchema, type Observation } from "./schemas";
import { CHUNK_OBSERVATION_PROMPT, wrapUntrustedSource } from "./prompts";

export async function extractChunkObservations(
  segmentText: string,
  locationHint?: Record<string, unknown>,
): Promise<Observation[]> {
  const prompt =
    CHUNK_OBSERVATION_PROMPT +
    "\n\n" +
    wrapUntrustedSource(segmentText) +
    (locationHint ? `\n\nLocation hint (JSON): ${JSON.stringify(locationHint)}` : "");

  const result = await extractJSON<{ observations?: unknown[] }>(prompt, (raw) => {
    const obs = (raw as { observations?: unknown[] }).observations ?? [];
    return { observations: obs.map((o) => ObservationSchema.parse(o)) };
  });

  const list = (result.observations ?? []) as Observation[];

  // Merge the location hint into the model's location so chunkId is preserved.
  return list.map((observation) => ({
    ...observation,
    location: {
      ...(locationHint as Observation["location"]),
      ...(observation.location ?? {}),
    },
  }));
}

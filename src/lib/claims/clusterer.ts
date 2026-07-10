/**
 * Observation clusterer (Phase 10.4 / 10.5).
 *
 * Greedily groups observations of the same type into claims. Two observations
 * join a cluster when their canonical text matches exactly OR their token
 * similarity is high. This avoids counting one loud source repeatedly as many
 * distinct claims while still separating genuinely different signals.
 */

import type { Observation } from "../extraction/schemas";
import { canonicalizeText, tokenSimilarity } from "./normalizer";

export interface ClaimCluster {
  type: string;
  canonicalText: string;
  observations: Observation[];
}

const SIMILARITY_THRESHOLD = 0.5;

export function clusterObservations(observations: Observation[]): ClaimCluster[] {
  const clusters: ClaimCluster[] = [];

  for (const obs of observations) {
    const can = canonicalizeText(obs.text);
    let best: ClaimCluster | null = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      if (cluster.type !== obs.type) continue;
      if (cluster.canonicalText === can) {
        best = cluster;
        bestScore = 1;
        break;
      }
      const sim = tokenSimilarity(cluster.canonicalText, obs.text);
      if (sim >= SIMILARITY_THRESHOLD && sim > bestScore) {
        best = cluster;
        bestScore = sim;
      }
    }

    if (best) {
      best.observations.push(obs);
    } else {
      clusters.push({ type: obs.type, canonicalText: can, observations: [obs] });
    }
  }

  return clusters;
}

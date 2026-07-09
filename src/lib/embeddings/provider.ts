/**
 * Embedding provider abstraction.
 * Uses OpenAI embeddings API (works with any compatible endpoint).
 */

import OpenAI from 'openai';
import { getConfig } from '../config';

let embeddingClient: OpenAI | null = null;

function getEmbeddingClient(): OpenAI {
  if (embeddingClient) return embeddingClient;
  const config = getConfig();
  embeddingClient = new OpenAI({
    apiKey: config.embeddingApiKey,
    baseURL: config.embeddingBaseUrl,
  });
  return embeddingClient;
}

/**
 * Generate embedding vector for a single text.
 */
export async function embed(text: string): Promise<number[]> {
  const config = getConfig();
  const client = getEmbeddingClient();

  const response = await client.embeddings.create({
    model: config.embeddingModel,
    input: text.slice(0, 8000), // Limit input length
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a batch.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const config = getConfig();
  const client = getEmbeddingClient();

  // OpenAI supports batch embedding up to ~2048 inputs
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map(t => t.slice(0, 8000));
    const response = await client.embeddings.create({
      model: config.embeddingModel,
      input: batch,
    });
    allEmbeddings.push(...response.data.map(d => d.embedding));
  }

  return allEmbeddings;
}

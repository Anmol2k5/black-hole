/**
 * LLM provider abstraction.
 * Supports OpenAI, Anthropic, and any OpenAI-compatible endpoint.
 */

import OpenAI from 'openai';
import { getConfig } from '../config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openaiClient) return openaiClient;
  const config = getConfig();
  openaiClient = new OpenAI({
    apiKey: config.llmApiKey,
    baseURL: config.llmBaseUrl,
  });
  return openaiClient;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'text' | 'json';
  }
): Promise<LLMResponse> {
  const config = getConfig();
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: options?.model || config.llmModel,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 4096,
    ...(options?.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
  });

  const choice = response.choices[0];
  return {
    content: choice?.message?.content || '',
    usage: response.usage ? {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    } : undefined,
  };
}

/**
 * Extract structured JSON from text using LLM.
 * Sends a system prompt instructing JSON output and parses the result.
 */
export async function extractJSON<T>(
  prompt: string,
  parseResult: (raw: unknown) => T
): Promise<T> {
  const response = await chatCompletion(
    [
      {
        role: 'system',
        content: 'You are a precise data extraction assistant. Always respond with valid JSON only. No markdown, no explanation, just JSON.',
      },
      { role: 'user', content: prompt },
    ],
    { responseFormat: 'json', temperature: 0.1, maxTokens: 8192 }
  );

  try {
    const parsed = JSON.parse(response.content);
    return parseResult(parsed);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return parseResult(parsed);
    }
    throw new Error(`Failed to parse LLM JSON response: ${response.content.slice(0, 200)}`);
  }
}

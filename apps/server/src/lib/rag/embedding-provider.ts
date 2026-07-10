import { createHash } from 'node:crypto';
import { AppError } from '../errors';

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

interface EmbeddingsApiResponse {
  data?: Array<{
    embedding?: number[];
  }>;
  error?: {
    message?: string;
  };
}

function normalizeVector(values: number[]): number[] {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return values;
  }
  return values.map((value) => value / magnitude);
}

export class HashMockEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly dimensions: number) {}

  async embed(text: string): Promise<number[]> {
    const values: number[] = [];
    let seed = createHash('sha256').update(text).digest();

    for (let index = 0; index < this.dimensions; index += 1) {
      if (index > 0 && index % seed.length === 0) {
        seed = createHash('sha256').update(seed).digest();
      }
      const byte = seed[index % seed.length] ?? 0;
      values.push((byte / 255) * 2 - 1);
    }

    return normalizeVector(values);
  }
}

export class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly timeoutMs: number,
    private readonly apiKey?: string
  ) {}

  async embed(text: string): Promise<number[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          input: text,
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as EmbeddingsApiResponse;

      if (!response.ok) {
        throw new AppError(
          'EMBEDDING_FAILED',
          payload.error?.message ?? `Embedding request failed with status ${response.status}`,
          response.status >= 500 ? 502 : response.status
        );
      }

      const embedding = payload.data?.[0]?.embedding;
      if (!embedding || embedding.length === 0) {
        throw new AppError('EMBEDDING_FAILED', 'Embedding response missing vector data', 502);
      }

      return embedding;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError('EMBEDDING_TIMEOUT', 'Embedding request timed out', 504);
      }
      throw new AppError(
        'EMBEDDING_FAILED',
        error instanceof Error ? error.message : 'Embedding request failed',
        502
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export interface CreateEmbeddingProviderInput {
  llmE2eMock: boolean;
  llmBaseUrl: string;
  llmApiKey?: string;
  llmTimeoutMs: number;
  embeddingModel: string;
  embeddingDimensions: number;
}

export function createEmbeddingProvider(input: CreateEmbeddingProviderInput): EmbeddingProvider {
  if (input.llmE2eMock) {
    return new HashMockEmbeddingProvider(input.embeddingDimensions);
  }

  return new OpenAiCompatibleEmbeddingProvider(
    input.llmBaseUrl,
    input.embeddingModel,
    input.llmTimeoutMs,
    input.llmApiKey
  );
}

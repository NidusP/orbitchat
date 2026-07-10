import { describe, expect, test } from 'bun:test';
import {
  createEmbeddingProvider,
  HashMockEmbeddingProvider,
} from './embedding-provider';

describe('HashMockEmbeddingProvider', () => {
  test('returns normalized vectors with configured dimensions', async () => {
    const provider = new HashMockEmbeddingProvider(8);
    const vector = await provider.embed('orbitchat rag test');

    expect(vector).toHaveLength(8);
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    expect(magnitude).toBeCloseTo(1, 5);
  });

  test('is deterministic for the same input', async () => {
    const provider = new HashMockEmbeddingProvider(16);
    const left = await provider.embed('same text');
    const right = await provider.embed('same text');

    expect(left).toEqual(right);
  });

  test('differs for different inputs', async () => {
    const provider = new HashMockEmbeddingProvider(16);
    const left = await provider.embed('travel post');
    const right = await provider.embed('cooking post');

    expect(left).not.toEqual(right);
  });
});

describe('createEmbeddingProvider', () => {
  test('uses hash mock when llmE2eMock is true', () => {
    const provider = createEmbeddingProvider({
      llmE2eMock: true,
      llmBaseUrl: 'http://localhost:11434/v1',
      llmTimeoutMs: 1000,
      embeddingModel: 'nomic-embed-text',
      embeddingDimensions: 32,
    });

    expect(provider).toBeInstanceOf(HashMockEmbeddingProvider);
  });
});

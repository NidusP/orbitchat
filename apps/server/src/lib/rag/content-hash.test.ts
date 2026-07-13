import { describe, expect, test } from 'bun:test';
import { hashChunkContent } from './content-hash';

describe('hashChunkContent', () => {
  test('returns stable sha256 hex for same input', () => {
    const first = hashChunkContent('hello rag');
    const second = hashChunkContent('hello rag');

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  test('differs when text changes', () => {
    expect(hashChunkContent('alpha')).not.toBe(hashChunkContent('beta'));
  });
});

process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, test } from 'bun:test';
import { HashMockEmbeddingProvider } from '../../lib/rag/embedding-provider';
import {
  createInMemoryChunkStore,
  createRagService,
} from './rag-service';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const POST_A = '55555555-5555-4555-8555-555555555555';
const POST_B = '66666666-6666-4666-8666-666666666666';
const EMBEDDING_DIMENSIONS = 768;

function createTestRagService() {
  const chunkStore = createInMemoryChunkStore();
  const embeddingProvider = new HashMockEmbeddingProvider(EMBEDDING_DIMENSIONS);

  const service = createRagService({
    chunkStore,
    embeddingProvider,
    ragEnabled: true,
    readFileFn: async (filePath) => {
      if (filePath.endsWith('product.md')) {
        return '# Orbitchat\n\nA social learning platform with AI assistant Orbit Guide.';
      }
      if (filePath.endsWith('api-spec.md')) {
        return '# API Spec\n\nAll business routes live under /api/v1/.';
      }
      throw new Error(`Unexpected file path: ${filePath}`);
    },
  });

  return { service, chunkStore, embeddingProvider };
}

describe('rag-service', () => {
  beforeEach(() => {
    // no shared module state to reset
  });

  test('indexPostChunk and searchMyPosts finds indexed content', async () => {
    const { service } = createTestRagService();

    const content = 'My summer travel diary from Kyoto';
    await service.indexPostChunk(POST_A, USER_A, content);

    const result = await service.searchMyPosts(USER_A, content, { limit: 5 });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]?.postId).toBe(POST_A);
    expect(result.items[0]?.text).toBe(content);
    expect(result.items[0]?.score).toBeGreaterThan(0.9);
  });

  test('searchMyPosts is scoped to the owner user', async () => {
    const { service } = createTestRagService();

    await service.indexPostChunk(POST_A, USER_A, 'User A private travel notes');
    await service.indexPostChunk(POST_B, USER_B, 'User B private travel notes');

    const userAResult = await service.searchMyPosts(USER_A, 'travel', { limit: 5 });
    const userBResult = await service.searchMyPosts(USER_B, 'travel', { limit: 5 });

    expect(userAResult.items.map((item) => item.postId)).toEqual([POST_A]);
    expect(userBResult.items.map((item) => item.postId)).toEqual([POST_B]);
    expect(userAResult.items.some((item) => item.postId === POST_B)).toBe(false);
    expect(userBResult.items.some((item) => item.postId === POST_A)).toBe(false);
  });

  test('searchHelpDocs returns indexed help doc chunk', async () => {
    const { service } = createTestRagService();

    await service.ensureHelpDocsIndexed();

    const result = await service.searchHelpDocs('Orbit Guide social platform', { limit: 5 });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.some((item) => item.sourceId === 'product.md')).toBe(true);
    expect(result.items[0]?.text.length).toBeGreaterThan(0);
    expect(result.items[0]?.score).toBeGreaterThan(0);
  });

  test('search falls back to text match when embedding fails', async () => {
    const chunkStore = createInMemoryChunkStore();
    const embeddingProvider = {
      embed: async () => {
        throw new Error('embedding unavailable');
      },
    };

    const service = createRagService({
      chunkStore,
      embeddingProvider,
      ragEnabled: true,
    });

    await chunkStore.upsertChunk({
      sourceType: 'post',
      sourceId: POST_A,
      text: 'Weekend hiking in the Alps',
      ownerUserId: USER_A,
      embedding: null,
    });

    const result = await service.searchMyPosts(USER_A, 'hiking', { limit: 5 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.postId).toBe(POST_A);
    expect(result.items[0]?.text).toContain('hiking');
    expect(result.items[0]?.score).toBe(0.5);
  });

  test('indexPostChunk skips work when RAG is disabled', async () => {
    const chunkStore = createInMemoryChunkStore();
    const service = createRagService({
      chunkStore,
      embeddingProvider: new HashMockEmbeddingProvider(EMBEDDING_DIMENSIONS),
      ragEnabled: false,
    });

    await service.indexPostChunk(POST_A, USER_A, 'Should not be indexed');

    expect(chunkStore.chunks).toHaveLength(0);
  });

  test('removePostChunk deletes post chunk', async () => {
    const { service, chunkStore } = createTestRagService();

    await service.indexPostChunk(POST_A, USER_A, 'Temporary post content');
    expect(chunkStore.chunks).toHaveLength(1);

    await service.removePostChunk(POST_A);
    expect(chunkStore.chunks).toHaveLength(0);
  });
});

process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Post } from '../db/schema/posts';
import type { PostAuthorSummary } from '@orbitchat/shared-types';
import { createPost, deletePost, updatePost } from './post-service';

const ragModule = await import('./ai/rag-service');
const socialLoaders = await import('../lib/social-loaders');

const POST_ID = '55555555-5555-4555-8555-555555555555';
const AUTHOR_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

const authorSummary: PostAuthorSummary = {
  id: AUTHOR_ID,
  username: 'orbit_author',
  displayName: 'Orbit Author',
  avatarUrl: null,
};

function mockAuthorLoaders(): void {
  spyOn(socialLoaders, 'loadAuthorSummaries').mockImplementation(
    async () => new Map([[AUTHOR_ID, authorSummary]])
  );
  spyOn(socialLoaders, 'loadLikedPostIds').mockImplementation(async () => new Set());
  spyOn(socialLoaders, 'loadPostMediaByPostIds').mockImplementation(async (postIds) => {
    const map = new Map<string, never[]>();
    for (const postId of postIds) {
      map.set(postId, []);
    }
    return map;
  });
}

const dbModule = await import('../db');

function samplePost(overrides: Partial<Post> = {}): Post {
  return {
    id: POST_ID,
    authorId: AUTHOR_ID,
    content: 'Hello feed',
    likeCount: 0,
    commentCount: 0,
    createdAt: new Date('2026-07-03T10:00:00.000Z'),
    updatedAt: new Date('2026-07-03T10:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('post-service robustness', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('updatePost rejects unchanged content', async () => {
    mockAuthorLoaders();
    spyOn(dbModule.db.query.posts, 'findFirst').mockImplementation(
      () => Promise.resolve(samplePost()) as never
    );

    await expect(
      updatePost(POST_ID, AUTHOR_ID, { content: 'Hello feed' })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  test('deletePost rejects already deleted post', async () => {
    spyOn(dbModule.db.query.posts, 'findFirst').mockImplementation(
      () =>
        Promise.resolve(
          samplePost({ deletedAt: new Date('2026-07-03T10:05:00.000Z') })
        ) as never
    );

    await expect(deletePost(POST_ID, AUTHOR_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  test('deletePost rejects non-author', async () => {
    spyOn(dbModule.db.query.posts, 'findFirst').mockImplementation(
      () => Promise.resolve(samplePost()) as never
    );

    await expect(deletePost(POST_ID, OTHER_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'FORBIDDEN',
        statusCode: 403,
      })
    );
  });
});

describe('post-service RAG hooks', () => {
  beforeEach(() => {
    mock.restore();
    mockAuthorLoaders();
  });

  test('createPost schedules indexPostChunk', async () => {
    const indexSpy = spyOn(ragModule, 'indexPostChunk').mockImplementation(() => Promise.resolve());

    spyOn(dbModule.db, 'insert').mockImplementation(
      () =>
        ({
          values: () => ({
            returning: () => Promise.resolve([samplePost({ content: 'Indexed post' })]),
          }),
        }) as never
    );

    const post = await createPost(AUTHOR_ID, { content: 'Indexed post' });

    expect(post.content).toBe('Indexed post');
    expect(indexSpy).toHaveBeenCalledWith(POST_ID, AUTHOR_ID, 'Indexed post');
  });

  test('updatePost schedules indexPostChunk after content change', async () => {
    const indexSpy = spyOn(ragModule, 'indexPostChunk').mockImplementation(() => Promise.resolve());

    spyOn(dbModule.db.query.posts, 'findFirst').mockImplementation(
      () => Promise.resolve(samplePost()) as never
    );

    spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: () =>
                Promise.resolve([samplePost({ content: 'Updated indexed post' })]),
            }),
          }),
        }) as never
    );

    await updatePost(POST_ID, AUTHOR_ID, { content: 'Updated indexed post' });

    expect(indexSpy).toHaveBeenCalledWith(POST_ID, AUTHOR_ID, 'Updated indexed post');
  });

  test('deletePost schedules removePostChunk', async () => {
    const removeSpy = spyOn(ragModule, 'removePostChunk').mockImplementation(() => Promise.resolve());

    spyOn(dbModule.db.query.posts, 'findFirst').mockImplementation(
      () => Promise.resolve(samplePost()) as never
    );

    const updateWhere = mock(() => Promise.resolve());
    spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: updateWhere,
          }),
        }) as never
    );

    await deletePost(POST_ID, AUTHOR_ID);

    expect(removeSpy).toHaveBeenCalledWith(POST_ID);
    expect(updateWhere).toHaveBeenCalled();
  });

  test('createPost links uploadIds and returns media', async () => {
    const uploadService = await import('./upload-service');
    const uploadId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const media = [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        uploadId,
        url: `/api/v1/media/${uploadId}`,
        mimeType: 'image/png',
        sizeBytes: 128,
        sortOrder: 0,
      },
    ];

    spyOn(uploadService, 'linkPostMedia').mockImplementation(async () => media);
    spyOn(ragModule, 'indexPostChunk').mockImplementation(() => Promise.resolve());

    spyOn(dbModule.db, 'insert').mockImplementation(
      () =>
        ({
          values: () => ({
            returning: () => Promise.resolve([samplePost({ content: '' })]),
          }),
        }) as never
    );

    const post = await createPost(AUTHOR_ID, { content: '', uploadIds: [uploadId] });

    expect(post.media).toEqual(media);
    expect(post.content).toBe('');
  });
});

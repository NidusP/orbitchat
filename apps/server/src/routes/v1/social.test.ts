process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { ClientMeta } from '../../middleware/client-meta';
import { Hono } from 'hono';
import { handleError } from '../../middleware/error';

const jwtLib = await import('../../lib/jwt');
const sessionService = await import('../../services/session-service');
const postService = await import('../../services/post-service');
const feedService = await import('../../services/feed-service');
const commentService = await import('../../services/comment-service');
const { postsRouter } = await import('./posts');
const { feedRouter } = await import('./feed');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const POST_ID = '22222222-2222-4222-8222-222222222222';

const samplePost = {
  id: POST_ID,
  authorId: USER_ID,
  content: 'Hello social',
  likeCount: 0,
  commentCount: 0,
  media: [],
  createdAt: '2026-06-30T10:00:00.000Z',
  updatedAt: '2026-06-30T10:00:00.000Z',
  author: {
    id: USER_ID,
    username: 'orbit',
    displayName: 'Orbit User',
    avatarUrl: null,
  },
  likedByMe: false,
};

function createAuthedApp(): Hono {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('clientMeta', {
      platform: 'web',
      version: '1.0.0',
      deviceId: 'device-1',
    } satisfies ClientMeta);
    await next();
  });
  app.route('/posts', postsRouter);
  app.route('/feed', feedRouter);
  app.onError((error, c) => handleError(error, c));
  return app;
}

function mockAuth(): void {
  spyOn(jwtLib, 'verifyAccessToken').mockImplementation(async () => ({
    sub: USER_ID,
    sid: 'session-1',
    platform: 'web',
    email: 'orbit@example.com',
    exp: 9999999999,
  }));
  spyOn(sessionService, 'assertValidSession').mockImplementation(async () => ({
    id: 'session-1',
    userId: USER_ID,
    deviceId: 'device-1',
    platform: 'web',
    deviceName: 'Chrome',
    isTrusted: false,
    refreshTokenHash: 'hash',
    lastActiveAt: new Date('2026-06-20T00:00:00.000Z'),
    expiresAt: new Date('2026-07-20T00:00:00.000Z'),
    revokedAt: null,
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
  }));
  spyOn(sessionService, 'touchSession').mockImplementation(async () => {});
}

describe('postsRouter', () => {
  beforeEach(() => {
    mock.restore();
    mockAuth();
    spyOn(postService, 'createPost').mockImplementation(async () => samplePost);
    spyOn(postService, 'getPostById').mockImplementation(async () => samplePost);
    spyOn(postService, 'updatePost').mockImplementation(async () => ({
      ...samplePost,
      content: 'Updated content',
    }));
    spyOn(postService, 'deletePost').mockImplementation(async () => {});
    spyOn(postService, 'likePost').mockImplementation(async () => ({
      liked: true,
      likeCount: 1,
    }));
    spyOn(commentService, 'listPostComments').mockImplementation(async () => ({
      items: [],
      nextCursor: null,
    }));
    spyOn(commentService, 'createComment').mockImplementation(async () => ({
      id: 'comment-1',
      postId: POST_ID,
      authorId: USER_ID,
      content: 'Nice',
      createdAt: '2026-06-30T10:01:00.000Z',
      updatedAt: '2026-06-30T10:01:00.000Z',
      author: samplePost.author,
    }));
  });

  test('creates a post', async () => {
    const createSpy = spyOn(postService, 'createPost');
    const app = createAuthedApp();
    const response = await app.request('/posts', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Hello social' }),
    });
    const body = (await response.json()) as { code: string; data: { content: string } };

    expect(response.status).toBe(201);
    expect(body.code).toBe('SUCCESS');
    expect(body.data.content).toBe('Hello social');
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  test('updates own post', async () => {
    const updateSpy = spyOn(postService, 'updatePost');
    const app = createAuthedApp();
    const response = await app.request(`/posts/${POST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Updated content' }),
    });
    const body = (await response.json()) as { code: string; data: { content: string } };

    expect(response.status).toBe(200);
    expect(body.data.content).toBe('Updated content');
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  test('deletes own post', async () => {
    const deleteSpy = spyOn(postService, 'deletePost');
    const app = createAuthedApp();
    const response = await app.request(`/posts/${POST_ID}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    });
    const body = (await response.json()) as { code: string; data: { deleted: boolean } };

    expect(response.status).toBe(200);
    expect(body.data.deleted).toBe(true);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  test('rejects empty post content', async () => {
    const app = createAuthedApp();
    const response = await app.request('/posts', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: '' }),
    });
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('rejects unauthenticated post create', async () => {
    const app = createAuthedApp();
    const response = await app.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello' }),
    });
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('rejects invalid post id format', async () => {
    const app = createAuthedApp();
    const response = await app.request('/posts/not-a-uuid', {
      method: 'GET',
    });
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('rejects empty comment content', async () => {
    const app = createAuthedApp();
    const response = await app.request(`/posts/${POST_ID}/comments`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: '   ' }),
    });
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('maps forbidden update to error envelope', async () => {
    const { AppError } = await import('../../lib/errors');
    spyOn(postService, 'updatePost').mockImplementation(async () => {
      throw new AppError('FORBIDDEN', 'You can only edit your own posts', 403);
    });
    const app = createAuthedApp();
    const response = await app.request(`/posts/${POST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Nope' }),
    });
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
  });

  test('maps not found post to error envelope', async () => {
    const { AppError } = await import('../../lib/errors');
    spyOn(postService, 'getPostById').mockImplementation(async () => {
      throw new AppError('NOT_FOUND', 'Post not found', 404);
    });
    const app = createAuthedApp();
    const response = await app.request(`/posts/${POST_ID}`);
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });
});

describe('feedRouter', () => {
  beforeEach(() => {
    mock.restore();
    mockAuth();
    spyOn(feedService, 'getHomeFeed').mockImplementation(async () => ({
      items: [samplePost],
      nextCursor: null,
    }));
  });

  test('returns home feed for authenticated user', async () => {
    const feedSpy = spyOn(feedService, 'getHomeFeed');
    const app = createAuthedApp();
    const response = await app.request('/feed/home', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const body = (await response.json()) as {
      code: string;
      data: { items: Array<{ id: string }> };
    };

    expect(response.status).toBe(200);
    expect(body.code).toBe('SUCCESS');
    expect(body.data.items.length).toBe(1);
    expect(feedSpy).toHaveBeenCalledTimes(1);
  });

  test('rejects unauthenticated home feed', async () => {
    const app = createAuthedApp();
    const response = await app.request('/feed/home');
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });
});

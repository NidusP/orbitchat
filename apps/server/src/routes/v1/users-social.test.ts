process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { Hono } from 'hono';
import { AppError } from '../../lib/errors';
import { handleError } from '../../middleware/error';

const jwtLib = await import('../../lib/jwt');
const sessionService = await import('../../services/session-service');
const followService = await import('../../services/follow-service');
const { usersRouter } = await import('./users');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

function createApp(): Hono {
  const app = new Hono();
  app.route('/users', usersRouter);
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

describe('usersRouter social boundaries', () => {
  beforeEach(() => {
    mock.restore();
    mockAuth();
    spyOn(followService, 'followUser').mockImplementation(async () => ({ following: true }));
    spyOn(followService, 'unfollowUser').mockImplementation(async () => ({ following: false }));
    spyOn(followService, 'searchUsers').mockImplementation(async () => ({ items: [], nextCursor: null }));
    spyOn(followService, 'getFollowers').mockImplementation(async () => ({ items: [], nextCursor: null }));
    spyOn(followService, 'getFollowing').mockImplementation(async () => ({ items: [], nextCursor: null }));
  });

  test('rejects search without query', async () => {
    const app = createApp();
    const response = await app.request('/users/search');
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('rejects follow without auth', async () => {
    const app = createApp();
    const response = await app.request(`/users/${OTHER_ID}/follow`, { method: 'POST' });
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('rejects invalid user id on follow', async () => {
    const app = createApp();
    const response = await app.request('/users/not-a-uuid/follow', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    });
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('maps follow self validation to error envelope', async () => {
    spyOn(followService, 'followUser').mockImplementation(async () => {
      throw new AppError('VALIDATION_ERROR', 'You cannot follow yourself', 400, { field: 'id' });
    });
    const app = createApp();
    const response = await app.request(`/users/${USER_ID}/follow`, {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    });
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('yourself');
  });

  test('maps missing user on followers list to not found', async () => {
    spyOn(followService, 'getFollowers').mockImplementation(async () => {
      throw new AppError('NOT_FOUND', 'User not found', 404);
    });
    const app = createApp();
    const response = await app.request(`/users/${OTHER_ID}/followers`);
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });
});

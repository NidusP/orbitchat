process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { Hono } from 'hono';
import { handleError } from '../../middleware/error';

const jwtLib = await import('../../lib/jwt');
const sessionService = await import('../../services/session-service');
const userService = await import('../../services/user-service');
const { usersRouter } = await import('./users');

function createApp(): Hono {
  const app = new Hono();
  app.route('/users', usersRouter);
  app.onError((error, c) => handleError(error, c));
  return app;
}

describe('usersRouter', () => {
  beforeEach(() => {
    mock.restore();
    spyOn(jwtLib, 'verifyAccessToken').mockImplementation(async () => ({
      sub: '11111111-1111-4111-8111-111111111111',
      sid: 'session-1',
      platform: 'web',
      email: 'orbit@example.com',
      exp: 9999999999,
    }));
    spyOn(sessionService, 'assertValidSession').mockImplementation(async () => ({
      id: 'session-1',
      userId: '11111111-1111-4111-8111-111111111111',
      deviceId: 'device-1',
      platform: 'web',
      deviceName: 'Chrome',
      isTrusted: true,
      refreshTokenHash: 'hash',
      lastActiveAt: new Date('2026-06-20T00:00:00.000Z'),
      expiresAt: new Date('2026-07-20T00:00:00.000Z'),
      revokedAt: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
    }));
    spyOn(sessionService, 'touchSession').mockImplementation(async () => {});
    spyOn(userService, 'getProfileByUserId').mockImplementation(async (userId: string) => ({
      id: 'profile-1',
      userId,
      displayName: 'Orbit User',
      bio: 'Hello Orbit',
      avatarUrl: null,
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    }));
    spyOn(userService, 'getUserById').mockImplementation(async (userId: string) => ({
      id: userId,
      username: 'orbit',
      email: 'orbit@example.com',
      isActive: true,
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    }));
    spyOn(userService, 'updateProfile').mockImplementation(async (userId: string, input) => ({
      id: 'profile-1',
      userId,
      displayName: input.displayName ?? 'Orbit User',
      bio: input.bio ?? null,
      avatarUrl: input.avatarUrl ?? null,
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    }));
    spyOn(userService, 'updateUser').mockImplementation(async (userId: string, input) => ({
      id: userId,
      username: input.username ?? 'orbit',
      email: input.email ?? 'orbit@example.com',
      isActive: true,
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    }));
  });

  test('returns a public profile', async () => {
    const app = createApp();
    const userId = '11111111-1111-4111-8111-111111111111';
    const response = await app.request(`/users/${userId}/profile`);
    const body = (await response.json()) as {
      code: string;
      data: { userId: string; displayName: string };
    };

    expect(response.status).toBe(200);
    expect(body.code).toBe('SUCCESS');
    expect(body.data.userId).toBe(userId);
    expect(body.data.displayName).toBe('Orbit User');
  });

  test('prevents a user from updating someone else profile', async () => {
    const updateProfileSpy = spyOn(userService, 'updateProfile');
    const app = createApp();
    const response = await app.request('/users/22222222-2222-4222-8222-222222222222/profile', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName: 'Intruder',
      }),
    });
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
    expect(updateProfileSpy).toHaveBeenCalledTimes(0);
  });

  test('updates the current user account', async () => {
    const updateUserSpy = spyOn(userService, 'updateUser');
    const app = createApp();
    const userId = '11111111-1111-4111-8111-111111111111';
    const response = await app.request(`/users/${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'new_orbit',
      }),
    });
    const body = (await response.json()) as {
      code: string;
      data: { username: string };
    };

    expect(response.status).toBe(200);
    expect(body.code).toBe('SUCCESS');
    expect(body.data.username).toBe('new_orbit');
    expect(updateUserSpy).toHaveBeenCalledTimes(1);
  });
});

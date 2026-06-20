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

const authService = await import('../../services/auth-service');
const jwtLib = await import('../../lib/jwt');
const sessionService = await import('../../services/session-service');
const { authRouter } = await import('./auth');

function createApp(platform: 'web' | 'ios' = 'web'): Hono {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('clientMeta', {
      platform,
      version: '1.0.0',
      deviceId: 'device-1',
    } satisfies ClientMeta);
    await next();
  });
  app.route('/auth', authRouter);
  app.onError((error, c) => handleError(error, c));
  return app;
}

describe('authRouter', () => {
  beforeEach(() => {
    mock.restore();

    spyOn(authService, 'login').mockImplementation(async (_input, clientMeta) => ({
      accessToken: 'access-token',
      expiresIn: 900,
      refreshToken: clientMeta.platform === 'ios' ? 'mobile-refresh-token' : 'refresh-token',
      refreshExpiresAt: new Date('2026-07-20T00:00:00.000Z'),
      user: {
        id: 'user-1',
        username: 'orbit',
        email: 'orbit@example.com',
        isActive: true,
        createdAt: '2026-06-20T00:00:00.000Z',
        updatedAt: '2026-06-20T00:00:00.000Z',
      },
      session: {
        id: 'session-1',
        userId: 'user-1',
        deviceId: 'device-1',
        platform: clientMeta.platform,
        deviceName: 'Chrome',
        isTrusted: false,
        lastActiveAt: '2026-06-20T00:00:00.000Z',
        expiresAt: '2026-07-20T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z',
      },
    }));
    spyOn(authService, 'refreshSession').mockImplementation(async () => ({
      accessToken: 'new-access-token',
      expiresIn: 900,
      refreshToken: 'rotated-refresh-token',
      refreshExpiresAt: new Date('2026-07-21T00:00:00.000Z'),
      session: {
        id: 'session-1',
        userId: 'user-1',
        deviceId: 'device-1',
        platform: 'web',
        deviceName: 'Chrome',
        isTrusted: false,
        lastActiveAt: '2026-06-20T00:00:00.000Z',
        expiresAt: '2026-07-21T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z',
      },
    }));
    spyOn(authService, 'logout').mockImplementation(async () => ({ success: true }));
    spyOn(authService, 'register').mockImplementation(async () => ({
      user: {
        id: 'user-1',
        username: 'orbit',
        email: 'orbit@example.com',
        isActive: true,
        createdAt: '2026-06-20T00:00:00.000Z',
        updatedAt: '2026-06-20T00:00:00.000Z',
      },
      profile: {
        id: 'profile-1',
        userId: 'user-1',
        displayName: 'Orbit User',
        bio: null,
        avatarUrl: null,
        createdAt: '2026-06-20T00:00:00.000Z',
        updatedAt: '2026-06-20T00:00:00.000Z',
      },
    }));
    spyOn(authService, 'listSessions').mockImplementation(async () => ({
      sessions: [],
      currentSessionId: 'session-1',
    }));
    spyOn(authService, 'logoutAll').mockImplementation(async () => ({ revokedCount: 0 }));
    spyOn(authService, 'revokeSession').mockImplementation(async () => ({ success: true }));
    spyOn(authService, 'trustSession').mockImplementation(async () => ({
      session: {
        id: 'session-1',
        userId: 'user-1',
        deviceId: 'device-1',
        platform: 'web',
        deviceName: 'Chrome',
        isTrusted: true,
        lastActiveAt: '2026-06-20T00:00:00.000Z',
        expiresAt: '2026-07-21T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z',
      },
    }));
    spyOn(jwtLib, 'verifyAccessToken').mockImplementation(async () => ({
      sub: 'user-1',
      sid: 'session-1',
      platform: 'web',
      email: 'orbit@example.com',
      exp: 9999999999,
    }));
    spyOn(sessionService, 'assertValidSession').mockImplementation(async () => ({
      id: 'session-1',
      userId: 'user-1',
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
  });

  test('returns refresh token via cookie for web login', async () => {
    const app = createApp('web');
    const response = await app.request('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'orbit@example.com',
        password: 'Password123!',
      }),
    });
    const body = (await response.json()) as {
      code: string;
      data: { accessToken: string; refreshToken?: string };
    };

    expect(response.status).toBe(200);
    expect(body.code).toBe('SUCCESS');
    expect(body.data.accessToken).toBe('access-token');
    expect(body.data.refreshToken).toBeUndefined();
    expect(response.headers.get('set-cookie')).toContain('refresh_token=refresh-token');
  });

  test('returns refresh token in response body for mobile login', async () => {
    const app = createApp('ios');
    const response = await app.request('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'orbit@example.com',
        password: 'Password123!',
      }),
    });
    const body = (await response.json()) as {
      data: { refreshToken?: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.refreshToken).toBe('mobile-refresh-token');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  test('accepts an empty JSON body on refresh when cookie token is present', async () => {
    const refreshSessionSpy = spyOn(authService, 'refreshSession');
    const app = createApp('web');
    const response = await app.request('/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'refresh_token=cookie-refresh-token',
      },
      body: '',
    });
    const body = (await response.json()) as {
      data: { accessToken: string; refreshToken?: string };
    };

    expect(response.status).toBe(200);
    expect(refreshSessionSpy).toHaveBeenCalledTimes(1);
    expect(body.data.accessToken).toBe('new-access-token');
    expect(body.data.refreshToken).toBeUndefined();
    expect(response.headers.get('set-cookie')).toContain('refresh_token=rotated-refresh-token');
  });

  test('clears the refresh cookie on web logout', async () => {
    const logoutSpy = spyOn(authService, 'logout');
    const app = createApp('web');
    const response = await app.request('/auth/logout', {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer valid-token',
      },
    });

    expect(response.status).toBe(200);
    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(response.headers.get('set-cookie')).toContain('refresh_token=');
  });
});

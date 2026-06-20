process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { Hono } from 'hono';
import { handleError } from './error';

const jwtLib = await import('../lib/jwt');
const sessionService = await import('../services/session-service');
const { authMiddleware } = await import('./auth');

function createApp(): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.get('/protected', (c) => c.json(c.get('auth')));
  app.onError((error, c) => handleError(error, c));
  return app;
}

describe('authMiddleware', () => {
  beforeEach(() => {
    mock.restore();
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

  test('rejects requests without a bearer token', async () => {
    const app = createApp();

    const response = await app.request('/protected');
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('injects auth context for a valid session', async () => {
    const verifyAccessTokenSpy = spyOn(jwtLib, 'verifyAccessToken');
    const assertValidSessionSpy = spyOn(sessionService, 'assertValidSession');
    const touchSessionSpy = spyOn(sessionService, 'touchSession');
    const app = createApp();

    const response = await app.request('/protected', {
      headers: {
        Authorization: 'Bearer valid-token',
      },
    });
    const body = (await response.json()) as {
      userId: string;
      sessionId: string;
      isTrusted: boolean;
    };

    expect(response.status).toBe(200);
    expect(verifyAccessTokenSpy).toHaveBeenCalledTimes(1);
    expect(assertValidSessionSpy).toHaveBeenCalledTimes(1);
    expect(touchSessionSpy).toHaveBeenCalledTimes(1);
    expect(body).toEqual({
      userId: 'user-1',
      sessionId: 'session-1',
      isTrusted: true,
    });
  });

  test('rejects a token whose session platform does not match', async () => {
    spyOn(sessionService, 'assertValidSession').mockImplementation(async () => ({
      id: 'session-1',
      userId: 'user-1',
      deviceId: 'device-1',
      platform: 'ios',
      deviceName: 'Chrome',
      isTrusted: true,
      refreshTokenHash: 'hash',
      lastActiveAt: new Date('2026-06-20T00:00:00.000Z'),
      expiresAt: new Date('2026-07-20T00:00:00.000Z'),
      revokedAt: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
    }));

    const app = createApp();
    const response = await app.request('/protected', {
      headers: {
        Authorization: 'Bearer valid-token',
      },
    });
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.message).toBe('Session platform mismatch');
  });
});

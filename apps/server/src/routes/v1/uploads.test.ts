process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.STORAGE_ENABLED = 'false';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { ClientMeta } from '../../middleware/client-meta';
import { Hono } from 'hono';
import { handleError } from '../../middleware/error';

const jwtLib = await import('../../lib/jwt');
const sessionService = await import('../../services/session-service');
const { uploadsRouter } = await import('./uploads');

const USER_ID = '11111111-1111-4111-8111-111111111111';

function createApp(): Hono {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('clientMeta', {
      platform: 'web',
      version: '1.0.0',
      deviceId: 'device-1',
    } satisfies ClientMeta);
    await next();
  });
  app.route('/uploads', uploadsRouter);
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
    isTrusted: true,
    refreshTokenHash: 'hash',
    lastActiveAt: new Date('2026-06-20T00:00:00.000Z'),
    expiresAt: new Date('2026-07-20T00:00:00.000Z'),
    revokedAt: null,
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
  }));
  spyOn(sessionService, 'touchSession').mockImplementation(async () => {});
}

describe('uploadsRouter', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('POST /uploads returns 503 when storage is disabled', async () => {
    mockAuth();
    const app = createApp();
    const form = new FormData();
    form.append('purpose', 'avatar');
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'avatar.png', { type: 'image/png' }));

    const response = await app.request('/uploads', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: form,
    });

    expect(response.status).toBe(503);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('SERVICE_UNAVAILABLE');
  });
});

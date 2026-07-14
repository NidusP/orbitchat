process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { ErrorResponse } from '@orbitchat/shared-types';
import { Hono } from 'hono';
import { handleError, handleNotFound } from '../../middleware/error';
import { clientMetaMiddleware } from '../../middleware/client-meta';
import { v1Router } from './index';

const jwtLib = await import('../../lib/jwt');
const sessionService = await import('../../services/session-service');
const authService = await import('../../services/auth-service');
const userService = await import('../../services/user-service');

const CLIENT_HEADERS = {
  'X-Client-Platform': 'web',
  'X-Client-Version': '1.0.0',
  'X-Device-Id': 'device-1',
} as const;

function createApp(): Hono {
  const app = new Hono();
  app.route('/api/v1', v1Router);
  app.notFound(handleNotFound);
  app.onError((error, c) => handleError(error, c));
  return app;
}

function assertErrorEnvelope(body: unknown): asserts body is ErrorResponse {
  const envelope = body as ErrorResponse;
  expect(typeof envelope.code).toBe('string');
  expect(typeof envelope.message).toBe('string');
  expect(typeof envelope.timestamp).toBe('string');
  expect(body).not.toHaveProperty('success');
}

describe('Phase 1 error envelopes', () => {
  beforeEach(() => {
    mock.restore();

    spyOn(jwtLib, 'verifyAccessToken').mockImplementation(async () => ({
      sub: '11111111-1111-4111-8111-111111111111',
      sid: '22222222-2222-4222-8222-222222222222',
      platform: 'web',
      email: 'orbit@example.com',
      exp: 9999999999,
    }));
    spyOn(sessionService, 'assertValidSession').mockImplementation(async () => ({
      id: '22222222-2222-4222-8222-222222222222',
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
    spyOn(authService, 'register').mockImplementation(async () => ({
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        username: 'orbit',
        email: 'orbit@example.com',
        isActive: true,
        emailVerifiedAt: '2026-06-20T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z',
        updatedAt: '2026-06-20T00:00:00.000Z',
      },
      profile: {
        id: 'profile-1',
        userId: '11111111-1111-4111-8111-111111111111',
        displayName: 'Orbit',
        bio: null,
        avatarUrl: null,
        createdAt: '2026-06-20T00:00:00.000Z',
        updatedAt: '2026-06-20T00:00:00.000Z',
      },
    }));
    spyOn(authService, 'login').mockImplementation(async () => {
      throw new Error('login should not be called in validation tests');
    });
    spyOn(authService, 'refreshSession').mockImplementation(async () => {
      throw new Error('refreshSession should not be called in validation tests');
    });
    spyOn(authService, 'trustSession').mockImplementation(async () => ({
      session: {
        id: '22222222-2222-4222-8222-222222222222',
        userId: '11111111-1111-4111-8111-111111111111',
        deviceId: 'device-1',
        platform: 'web',
        deviceName: 'Chrome',
        isTrusted: true,
        lastActiveAt: '2026-06-20T00:00:00.000Z',
        expiresAt: '2026-07-20T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z',
      },
    }));
    spyOn(userService, 'updateUser').mockImplementation(async (userId, input) => ({
      id: userId,
      username: input.username ?? 'orbit',
      email: input.email ?? 'orbit@example.com',
      isActive: true,
      emailVerifiedAt: '2026-06-20T00:00:00.000Z',
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    }));
    spyOn(userService, 'updateProfile').mockImplementation(async (userId, input) => ({
      id: 'profile-1',
      userId,
      displayName: input.displayName ?? 'Orbit',
      bio: input.bio ?? null,
      avatarUrl: input.avatarUrl ?? null,
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    }));
  });

  test('client meta middleware returns a standard validation error', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'orbit',
        email: 'orbit@example.com',
        password: 'Password123',
        displayName: 'Orbit',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    assertErrorEnvelope(body);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('X-Client-Platform');
  });

  test('register returns readable validation errors', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: {
        ...CLIENT_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'orbit',
        email: 'orbit@example.com',
        password: 'password123',
        displayName: 'Orbit',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    assertErrorEnvelope(body);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Password does not meet requirements');
  });

  test('login returns readable validation errors', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        ...CLIENT_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'Password123',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    assertErrorEnvelope(body);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Invalid email format');
  });

  test('refresh returns readable validation errors for malformed body', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: {
        ...CLIENT_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: '',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    assertErrorEnvelope(body);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Refresh token must not be empty');
  });

  test('refresh returns unauthorized when token is missing', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: {
        ...CLIENT_HEADERS,
      },
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    assertErrorEnvelope(body);
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.message).toBe('Refresh token required');
  });

  test('trust session returns readable validation errors', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/auth/sessions/trust', {
      method: 'POST',
      headers: {
        ...CLIENT_HEADERS,
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    assertErrorEnvelope(body);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Trust flag is required');
  });

  test('delete session validates session id format', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/auth/sessions/not-a-uuid', {
      method: 'DELETE',
      headers: {
        ...CLIENT_HEADERS,
        Authorization: 'Bearer valid-token',
      },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    assertErrorEnvelope(body);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Invalid session id');
  });

  test('users routes validate user id format', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/users/not-a-uuid', {
      headers: CLIENT_HEADERS,
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    assertErrorEnvelope(body);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Invalid user id');
  });

  test('patch user requires at least one field', async () => {
    const app = createApp();
    const userId = '11111111-1111-4111-8111-111111111111';
    const response = await app.request(`/api/v1/users/${userId}`, {
      method: 'PATCH',
      headers: {
        ...CLIENT_HEADERS,
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    assertErrorEnvelope(body);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('At least one field is required');
  });

  test('patch profile requires at least one field', async () => {
    const app = createApp();
    const userId = '11111111-1111-4111-8111-111111111111';
    const response = await app.request(`/api/v1/users/${userId}/profile`, {
      method: 'PATCH',
      headers: {
        ...CLIENT_HEADERS,
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    assertErrorEnvelope(body);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('At least one field is required');
  });

  test('unknown routes return not found envelope', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/does-not-exist', {
      headers: CLIENT_HEADERS,
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    assertErrorEnvelope(body);
    expect(body.code).toBe('NOT_FOUND');
  });
});

describe('clientMetaMiddleware', () => {
  test('rejects invalid platform values with standard envelope', async () => {
    const app = new Hono();
    app.use('*', clientMetaMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));
    app.onError((error, c) => handleError(error, c));

    const response = await app.request('/test', {
      headers: {
        'X-Client-Platform': 'invalid-platform',
        'X-Client-Version': '1.0.0',
        'X-Device-Id': 'device-1',
      },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    assertErrorEnvelope(body);
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

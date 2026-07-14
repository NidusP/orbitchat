process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, setSystemTime, spyOn, test } from 'bun:test';
import { AppError } from '../lib/errors';

const cryptoLib = await import('../lib/crypto');
const jwtLib = await import('../lib/jwt');
const ttlLib = await import('../lib/ttl');
const sessionService = await import('./session-service');
const userService = await import('./user-service');
const authService = await import('./auth-service');

function assertAppError(error: unknown, code: string, statusCode: number): void {
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  expect((error as AppError).statusCode).toBe(statusCode);
}

describe('auth-service', () => {
  beforeEach(() => {
    mock.restore();
    setSystemTime(new Date('2026-06-20T00:00:00.000Z'));

    spyOn(cryptoLib, 'verifyPassword').mockImplementation(async () => true);
    spyOn(jwtLib, 'signAccessToken').mockImplementation(async () => 'access-token');
    spyOn(jwtLib, 'getAccessTokenTtlSeconds').mockImplementation(() => 900);
    spyOn(ttlLib, 'ttlToDate').mockImplementation(() => new Date('2026-07-20T00:00:00.000Z'));

    spyOn(sessionService, 'createSession').mockImplementation(async (input) => ({
      session: {
        id: 'session-1',
        userId: input.userId,
        deviceId: input.deviceId,
        platform: input.platform,
        deviceName: input.deviceName ?? null,
        isTrusted: input.isTrusted,
        refreshTokenHash: 'hashed-refresh-token',
        lastActiveAt: new Date('2026-06-20T00:00:00.000Z'),
        expiresAt: input.expiresAt,
        revokedAt: null,
        createdAt: new Date('2026-06-20T00:00:00.000Z'),
      },
      refreshToken: 'refresh-token',
    }));
    spyOn(sessionService, 'findSessionByRefreshToken').mockImplementation(async () => undefined);
    spyOn(sessionService, 'listActiveSessionsForUser').mockImplementation(async () => []);
    spyOn(sessionService, 'revokeAllExcept').mockImplementation(async () => 0);
    spyOn(sessionService, 'revokePlatformSessions').mockImplementation(async () => {});
    spyOn(sessionService, 'revokeSessionById').mockImplementation(async () => {});
    spyOn(sessionService, 'rotateRefreshToken').mockImplementation(async (sessionId, expiresAt) => ({
      session: {
        id: sessionId,
        userId: 'user-1',
        deviceId: 'device-1',
        platform: 'web',
        deviceName: 'Chrome',
        isTrusted: true,
        refreshTokenHash: 'rotated-hash',
        lastActiveAt: new Date('2026-06-20T00:00:00.000Z'),
        expiresAt,
        revokedAt: null,
        createdAt: new Date('2026-06-20T00:00:00.000Z'),
      },
      refreshToken: 'rotated-refresh-token',
    }));
    spyOn(sessionService, 'updateSessionTrust').mockImplementation(async (_sessionId, _userId, trust) => ({
      id: 'session-1',
      userId: 'user-1',
      deviceId: 'device-1',
      platform: 'web',
      deviceName: 'Chrome',
      isTrusted: trust,
      lastActiveAt: '2026-06-20T00:00:00.000Z',
      expiresAt: '2026-07-20T00:00:00.000Z',
      createdAt: '2026-06-20T00:00:00.000Z',
    }));

    spyOn(userService, 'assertActiveUser').mockImplementation(async () => ({
      id: 'user-1',
      username: 'orbit',
      email: 'orbit@example.com',
      passwordHash: 'hashed-password',
      isActive: true,
      emailVerifiedAt: new Date('2026-06-20T00:00:00.000Z'),
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z'),
    }));
    spyOn(userService, 'findUserByEmail').mockImplementation(async () => ({
      id: 'user-1',
      username: 'orbit',
      email: 'orbit@example.com',
      passwordHash: 'hashed-password',
      isActive: true,
      emailVerifiedAt: new Date('2026-06-20T00:00:00.000Z'),
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z'),
    }));
    spyOn(userService, 'registerUser').mockImplementation(async () => ({
      user: {
        id: 'user-1',
        username: 'orbit',
        email: 'orbit@example.com',
        isActive: true,
        emailVerifiedAt: '2026-06-20T00:00:00.000Z',
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
  });

  test('login creates a new same-platform session and returns token bundle', async () => {
    const revokePlatformSessionsSpy = spyOn(sessionService, 'revokePlatformSessions');
    const createSessionSpy = spyOn(sessionService, 'createSession');
    const signAccessTokenSpy = spyOn(jwtLib, 'signAccessToken');

    const result = await authService.login(
      {
        email: 'orbit@example.com',
        password: 'Password123!',
        deviceName: 'Chrome on Mac',
        rememberMe: false,
        trustDevice: true,
      },
      {
        platform: 'web',
        version: '1.0.0',
        deviceId: 'device-1',
      }
    );

    expect(revokePlatformSessionsSpy).toHaveBeenCalledTimes(1);
    expect(createSessionSpy).toHaveBeenCalledTimes(1);
    expect(signAccessTokenSpy).toHaveBeenCalledTimes(1);
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user.email).toBe('orbit@example.com');
    expect(result.session.platform).toBe('web');
  });

  test('login rejects invalid credentials', async () => {
    spyOn(cryptoLib, 'verifyPassword').mockImplementation(async () => false);
    const revokePlatformSessionsSpy = spyOn(sessionService, 'revokePlatformSessions');
    const createSessionSpy = spyOn(sessionService, 'createSession');

    try {
      await authService.login(
        {
          email: 'orbit@example.com',
          password: 'wrong-password',
        },
        {
          platform: 'web',
          version: '1.0.0',
          deviceId: 'device-1',
        }
      );

      throw new Error('Expected login to throw');
    } catch (error) {
      assertAppError(error, 'UNAUTHORIZED', 401);
      expect(revokePlatformSessionsSpy).toHaveBeenCalledTimes(0);
      expect(createSessionSpy).toHaveBeenCalledTimes(0);
    }
  });

  test('refreshSession revokes expired sessions', async () => {
    const revokeSessionByIdSpy = spyOn(sessionService, 'revokeSessionById');
    spyOn(sessionService, 'findSessionByRefreshToken').mockImplementation(async () => ({
      id: 'session-1',
      userId: 'user-1',
      deviceId: 'device-1',
      platform: 'web',
      deviceName: 'Chrome',
      isTrusted: false,
      refreshTokenHash: 'hash',
      lastActiveAt: new Date('2026-06-19T00:00:00.000Z'),
      expiresAt: new Date('2026-06-19T00:00:00.000Z'),
      revokedAt: null,
      createdAt: new Date('2026-06-10T00:00:00.000Z'),
    }));

    try {
      await authService.refreshSession('expired-refresh-token', {
        platform: 'web',
        version: '1.0.0',
        deviceId: 'device-1',
      });

      throw new Error('Expected refreshSession to throw');
    } catch (error) {
      assertAppError(error, 'UNAUTHORIZED', 401);
      expect(revokeSessionByIdSpy).toHaveBeenCalledTimes(1);
    }
  });

  test('refreshSession rotates the refresh token for a valid session', async () => {
    const rotateRefreshTokenSpy = spyOn(sessionService, 'rotateRefreshToken');
    spyOn(sessionService, 'findSessionByRefreshToken').mockImplementation(async () => ({
      id: 'session-1',
      userId: 'user-1',
      deviceId: 'device-1',
      platform: 'web',
      deviceName: 'Chrome',
      isTrusted: false,
      refreshTokenHash: 'hash',
      lastActiveAt: new Date('2026-06-19T00:00:00.000Z'),
      expiresAt: new Date('2026-07-20T00:00:00.000Z'),
      revokedAt: null,
      createdAt: new Date('2026-06-10T00:00:00.000Z'),
    }));

    const result = await authService.refreshSession('refresh-token', {
      platform: 'web',
      version: '1.0.0',
      deviceId: 'device-1',
    });

    expect(rotateRefreshTokenSpy).toHaveBeenCalledTimes(1);
    expect(result.refreshToken).toBe('rotated-refresh-token');
    expect(result.accessToken).toBe('access-token');
  });

  test('revokeSession blocks untrusted devices from revoking another session', async () => {
    const revokeSessionByIdSpy = spyOn(sessionService, 'revokeSessionById');

    try {
      await authService.revokeSession('target-session', 'user-1', 'current-session', false);

      throw new Error('Expected revokeSession to throw');
    } catch (error) {
      assertAppError(error, 'FORBIDDEN', 403);
      expect(revokeSessionByIdSpy).toHaveBeenCalledTimes(0);
    }
  });
});

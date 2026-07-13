process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { InteractionNotification } from '@orbitchat/shared-types';
import { Hono } from 'hono';
import { handleError } from '../../middleware/error';

const jwtLib = await import('../../lib/jwt');
const sessionService = await import('../../services/session-service');
const notificationService = await import('../../services/notification-service');
const { notificationsRouter } = await import('./notifications');

const USER_ID = '11111111-1111-4111-8111-111111111111';

const sampleNotification: InteractionNotification = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  type: 'post_liked',
  actor: {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'luna',
    displayName: 'Luna User',
    avatarUrl: null,
  },
  post: {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    contentPreview: 'Hello world',
  },
  readAt: null,
  createdAt: '2026-07-13T01:00:00.000Z',
};

function createApp(): Hono {
  const app = new Hono();
  app.route('/notifications', notificationsRouter);
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

function authHeaders() {
  return {
    Authorization: 'Bearer test-token',
    'X-Client-Platform': 'web',
    'X-Client-Version': '1.0.0',
    'X-Device-Id': 'device-1',
  };
}

describe('notifications routes', () => {
  beforeEach(() => {
    mock.restore();
    mockAuth();
  });

  test('GET /notifications returns notification list', async () => {
    const listSpy = spyOn(notificationService, 'listNotifications').mockResolvedValue({
      items: [sampleNotification],
      nextCursor: null,
    });

    const app = createApp();
    const response = await app.request('/notifications?limit=10', {
      headers: authHeaders(),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { items: Array<{ type: string }> };
    };
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].type).toBe('post_liked');
    expect(listSpy).toHaveBeenCalledWith(USER_ID, { limit: 10 });
  });

  test('GET /notifications/unread-count returns unread count', async () => {
    const countSpy = spyOn(notificationService, 'getUnreadNotificationCount').mockResolvedValue(3);

    const app = createApp();
    const response = await app.request('/notifications/unread-count', {
      headers: authHeaders(),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { count: number } };
    expect(body.data.count).toBe(3);
    expect(countSpy).toHaveBeenCalledWith(USER_ID);
  });

  test('PATCH /notifications/read marks notifications read', async () => {
    const markSpy = spyOn(notificationService, 'markNotificationsRead').mockResolvedValue(2);

    const app = createApp();
    const response = await app.request('/notifications/read', {
      method: 'PATCH',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notificationIds: [sampleNotification.id] }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { updated: number } };
    expect(body.data.updated).toBe(2);
    expect(markSpy).toHaveBeenCalledWith(USER_ID, {
      notificationIds: [sampleNotification.id],
    });
  });
});

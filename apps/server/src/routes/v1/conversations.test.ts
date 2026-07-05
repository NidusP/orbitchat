process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Conversation, Message } from '@orbitchat/shared-types';
import { Hono } from 'hono';
import { handleError } from '../../middleware/error';

const jwtLib = await import('../../lib/jwt');
const sessionService = await import('../../services/session-service');
const conversationService = await import('../../services/conversation-service');
const messageService = await import('../../services/message-service');
const { conversationsRouter } = await import('./conversations');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
const MESSAGE_ID = '44444444-4444-4444-8444-444444444444';

const sampleConversation: Conversation = {
  id: CONVERSATION_ID,
  type: 'direct',
  participants: [
    {
      id: USER_ID,
      username: 'orbit',
      displayName: 'Orbit User',
      avatarUrl: null,
    },
    {
      id: OTHER_USER_ID,
      username: 'luna',
      displayName: 'Luna User',
      avatarUrl: null,
    },
  ],
  lastMessage: null,
  lastMessageAt: null,
  unreadCount: 0,
  createdAt: '2026-07-03T10:00:00.000Z',
  updatedAt: '2026-07-03T10:00:00.000Z',
};

const sampleMessage: Message = {
  id: MESSAGE_ID,
  conversationId: CONVERSATION_ID,
  sender: {
    id: USER_ID,
    username: 'orbit',
    displayName: 'Orbit User',
    avatarUrl: null,
  },
  content: 'Hello Luna',
  createdAt: '2026-07-03T10:01:00.000Z',
  editedAt: null,
  deletedAt: null,
};

function createApp(): Hono {
  const app = new Hono();
  app.route('/conversations', conversationsRouter);
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

describe('conversationsRouter', () => {
  beforeEach(() => {
    mock.restore();
    mockAuth();
    spyOn(conversationService, 'listConversations').mockImplementation(async () => ({
      items: [sampleConversation],
      nextCursor: null,
    }));
    spyOn(conversationService, 'createOrGetDirectConversation').mockImplementation(async () => ({
      conversation: sampleConversation,
      created: true,
    }));
    spyOn(conversationService, 'getConversationDto').mockImplementation(async () => sampleConversation);
    spyOn(messageService, 'listMessages').mockImplementation(async () => ({
      items: [sampleMessage],
      nextCursor: null,
    }));
    spyOn(messageService, 'createMessage').mockImplementation(async () => sampleMessage);
    spyOn(messageService, 'markConversationRead').mockImplementation(async () => ({
      conversationId: CONVERSATION_ID,
      lastReadAt: '2026-07-03T10:02:00.000Z',
    }));
  });

  test('lists conversations for the current user', async () => {
    const listSpy = spyOn(conversationService, 'listConversations');
    const app = createApp();
    const response = await app.request('/conversations?limit=20', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const body = (await response.json()) as { code: string; data: { items: Conversation[] } };

    expect(response.status).toBe(200);
    expect(body.code).toBe('SUCCESS');
    expect(body.data.items[0]?.id).toBe(CONVERSATION_ID);
    expect(listSpy).toHaveBeenCalledWith(USER_ID, { limit: 20 });
  });

  test('creates a direct conversation', async () => {
    const createSpy = spyOn(conversationService, 'createOrGetDirectConversation');
    const app = createApp();
    const response = await app.request('/conversations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ participantUserId: OTHER_USER_ID }),
    });
    const body = (await response.json()) as { code: string; data: Conversation };

    expect(response.status).toBe(201);
    expect(body.data.id).toBe(CONVERSATION_ID);
    expect(createSpy).toHaveBeenCalledWith(USER_ID, { participantUserId: OTHER_USER_ID });
  });

  test('gets one conversation', async () => {
    const getSpy = spyOn(conversationService, 'getConversationDto');
    const app = createApp();
    const response = await app.request(`/conversations/${CONVERSATION_ID}`, {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const body = (await response.json()) as { code: string; data: Conversation };

    expect(response.status).toBe(200);
    expect(body.code).toBe('SUCCESS');
    expect(body.data.id).toBe(CONVERSATION_ID);
    expect(getSpy).toHaveBeenCalledWith(CONVERSATION_ID, USER_ID);
  });

  test('lists messages in a conversation', async () => {
    const listSpy = spyOn(messageService, 'listMessages');
    const app = createApp();
    const response = await app.request(`/conversations/${CONVERSATION_ID}/messages?limit=10`, {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const body = (await response.json()) as { code: string; data: { items: Message[] } };

    expect(response.status).toBe(200);
    expect(body.data.items[0]?.content).toBe('Hello Luna');
    expect(listSpy).toHaveBeenCalledWith(CONVERSATION_ID, USER_ID, { limit: 10 });
  });

  test('creates a message', async () => {
    const createSpy = spyOn(messageService, 'createMessage');
    const app = createApp();
    const response = await app.request(`/conversations/${CONVERSATION_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Hello Luna' }),
    });
    const body = (await response.json()) as { code: string; data: Message };

    expect(response.status).toBe(201);
    expect(body.data.id).toBe(MESSAGE_ID);
    expect(createSpy).toHaveBeenCalledWith(CONVERSATION_ID, USER_ID, { content: 'Hello Luna' });
  });

  test('marks a conversation as read', async () => {
    const readSpy = spyOn(messageService, 'markConversationRead');
    const app = createApp();
    const response = await app.request(`/conversations/${CONVERSATION_ID}/read`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ readAt: '2026-07-03T10:02:00.000Z' }),
    });
    const body = (await response.json()) as {
      code: string;
      data: { conversationId: string; lastReadAt: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.conversationId).toBe(CONVERSATION_ID);
    expect(readSpy).toHaveBeenCalledWith(CONVERSATION_ID, USER_ID, {
      readAt: '2026-07-03T10:02:00.000Z',
    });
  });

  test('rejects invalid conversation id format', async () => {
    const app = createApp();
    const response = await app.request('/conversations/not-a-uuid/messages', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('rejects empty message content', async () => {
    const app = createApp();
    const response = await app.request(`/conversations/${CONVERSATION_ID}/messages`, {
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

  test('rejects unauthenticated conversation list', async () => {
    const app = createApp();
    const response = await app.request('/conversations');
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });
});
